import requests
import json
import io
import logging
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

app = FastAPI()

# 设置日志记录
logging.basicConfig(level=logging.INFO)


class BackendApi:
    def __init__(self, config: dict) -> None:
        self.api_key = config['api_key']
        self.api_url = config['api_url']
        self.embeddings = HuggingFaceEmbeddings(model_name=config['embedding_model_path'],
                                                model_kwargs={'device': 'cuda'})
        logging.info('嵌入模型初始化成功')
        self.vector_store = FAISS.load_local(config['faiss_store_path'], embeddings=self.embeddings,
                                             allow_dangerous_deserialization=True)
        logging.info('FAISS存储加载完成')
        # self.models = ["qwen-max-longcontext", "qwen-max", "qwen-max-0107", 'qwen-max-0403', 'qwen-max-0428']  # 模型列表

    async def conversation(self, request: Request):
        logging.info('接收到新的对话请求')
        try:
            data = await request.json()
            conversation_history = data['meta']['content']['conversation']
            prompt = data['meta']['content']['parts'][0]['content']

            logging.info(f'提示词: {prompt}')
            docs = self.vector_store.similarity_search(prompt)
            context = [doc.page_content for doc in docs]

            history_text = "\n".join([entry['content'] for entry in conversation_history])
            my_input = "\n".join(context)
            prompts = f"""
                已知这些医疗问答数据：
                {my_input}

                以下是之前的对话内容：
                {history_text}

                请回答以下问题：
                {prompt}
                要求：
                1.如果问答数据中并没有这个问题的答案，请你说明情况，并且给出相关问题的答案；如果有这个问题的答案，请你回答的详细而全面。
                2.在回答的最后要写出文章来源链接（如有则必须写出，并且必须写完整写全）、时间（如有则必须写出并写全，别写冗余信息），医生信息（如有则必须写出写全，别写冗余信息，正确与否要自行判断上下文，如果不确定就不要写，就写未知）。
                3.不要写任何和问题无关的内容，不要写任何和问题无关的内容，不要写任何和问题无关的内容，重要的事情说三遍。
                4.我再强调一下，最后要写出文章来源链接（如有则必须写出，并且必须写完整写全）、时间（如有则必须写出并写全，别写冗余信息），医生信息（如有则必须写出写全，别写冗余信息，正确与否要自行判断上下文，如果不确定就不要写，就写未知）。
                5.书写格式请规范，注意格式的一致性，该换行的时候换行，在一句话结束后需先写换行符再写'-'。
                7.注意书写的规范性，该换行的时候换行，必要的时候加粗显示，不要写错别字，不能写其他无关的内容，注意加粗的字体之前要换号。
                8.如果问“你是谁”，你只要回复“我是您的医疗专家顾问，请问有什么问题要问呢？”就行。
                9.你不要在回答中提到你是基于问答数据来回答的，你直接回答就行。
            """
            messages = [{'role': 'system', 'content': '你是一个医疗健康顾问，来解答医疗健康问题'},
                        {'role': 'user', 'content': prompts}]

            return StreamingResponse(self.get_response(messages), media_type="text/event-stream")

        except KeyError as e:
            logging.error(f"缺少必要的请求数据: {e}")
            return Response(content='{"error": "请求错误了"}', media_type="application/json", status_code=400)
        except Exception as e:
            logging.error(f"对话发生错误: {e}")
            return Response(content=f'{{"error": "网络有问题: {str(e)}"}}', media_type="application/json",
                            status_code=500)

    def get_response(self, messages):
        url = "https://gallery.cn-southwest-2.myhuaweicloud.com/v1/gallery/bb036532-7c78-41fe-9811-35825efa685d/"
        headers = {
            "Content-Type": "application/json"
        }
        data = {
            "model": "qwen2-7b-instruct",
            "messages": messages,
            "max_tokens": 2000,
            "top_k": 20,
            "top_p": 0.8,
            "temperature": 0.1,
            "ignore_eos": False,
            "stream": True
        }

        try:
            response = requests.post(url, headers=headers, json=data, timeout=10, stream=True)

            if response.status_code == 200:
                content = ""
                for line in response.iter_lines(decode_unicode=True):
                    if line:
                        line = line.strip()
                        if line.startswith("data: "):
                            line = line[len("data: "):]
                        if line != "[DONE]":
                            try:
                                chunk = json.loads(line)
                                delta = chunk['choices'][0]['delta']
                                if 'content' in delta:
                                    content_piece = delta['content']
                                    content += content_piece
                                    yield content_piece
                            except json.JSONDecodeError:
                                logging.error("Failed to decode JSON from response line")
                                logging.error(f"Response line: {line}")
            else:
                logging.error(f"API returned a non-200 status code: {response.status_code}")
                logging.error(f"Response content: {response.text}")

        except requests.exceptions.Timeout:
            logging.warning("Request to model timed out.")
        except requests.exceptions.RequestException as e:
            logging.error(f"RequestException: {e}")


# 读取配置文件
with open(r'D:\lyx\bigmodel\lyx_gpt\config.json', 'r') as f:
    config = json.load(f)

backend_api = BackendApi(config)


@app.post("/conversation")
async def conversation(request: Request):
    return await backend_api.conversation(request)
