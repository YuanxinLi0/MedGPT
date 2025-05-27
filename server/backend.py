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
                                                model_kwargs={'device': 'cpu'})
        logging.info('嵌入模型初始化成功')
        self.vector_store = FAISS.load_local(config['faiss_store_path'], embeddings=self.embeddings,
                                             allow_dangerous_deserialization=True)
        logging.info('FAISS存储加载完成')
        # self.models = ["qwen-max-longcontext", "qwen-max", "qwen-max-0107", 'qwen-max-0403', 'qwen-max-0428']  # 模型列表
        # self.models = ['qwen2-72b-instruct']
        # self.models = ['llama3.1-405b-instruct']
        # self.models = ['qwen1.5-72b-chat']
        self.models = ['qwen-long']
        # self.models = ['qwen1.5-72b-chat']

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
                        已知以下医疗问答数据：
                        {my_input}
                        
                        以下是之前的对话内容：
                        {history_text}
                        
                        请回答以下问题：
                        {prompt}
                        
                        要求：
                        1. 如果问答数据中没有这个问题的答案，请说明并提供相关问题的答案；如果有，请详细、全面地回答。
                        2. 在回答的最后，必须包含文章来源链接（如有则需完整写出）、时间（如有则需完整写出）、医生信息（如有则需完整写出；若不确定，请写“未知”）。
                        3. 请确保内容与问题高度相关，不要包含任何无关信息。
                        4. 请严格遵循以下书写格式：
                           - 结构清晰，适当换行。
                           - 使用加粗文本突出重点内容。
                           - 保证拼写和语法的准确性，避免错别字。
                        5. 特殊提示：如果问“你是谁”，请仅回复“我是您的医疗专家顾问，请问有什么问题要问呢？”。
                        6. 当用户描述某种症状（如咳嗽、腰痛等），请根据已知数据推测可能的病因。
                            写法参考：
                            **贫血对身体系统的影响**
                            贫血，尤其是重度贫血，由于减少了血液向身体组织输送氧气的能力，会对全身多个系统造成负面影响。以下是贫血可能影响的主要身体系统及其表现：
                            
                            1. **心血管系统**：为了补偿氧气的不足，心脏需更加努力地泵血，长期可能导致心律失常、心脏扩大甚至心力衰竭。
                            2. **神经系统**：低氧水平可干扰大脑功能，引起疲劳、头晕、记忆力减退和注意力难以集中等问题。
                            3. **呼吸系统**：严重贫血时，肺部需加速工作提高氧气摄入，可能导致气短或呼吸困难。
                            4. **免疫系统**：贫血可能削弱免疫反应，因为白细胞和其他关键免疫成分的功能可能受影响。
                            
                            综上所述，贫血不仅是一个简单的血液问题；它能广泛影响人体各个器官系统的正常运作。因此，对于出现持续性贫血症状的人群，寻求专业医疗意见进行准确诊断并采取相应治疗措施是非常重要的。
                            
                            来源1：（没有则写“未知”）
                            医生信息：（没有则不写）
                            发布时间：（没有则写“未知”）
                            
                            来源2：（没有则写“未知”）
                            医生信息：（没有则不写）
                            发布时间：（没有则写“未知”）
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
        for model in self.models:
            try:
                response = requests.post(
                    f"{self.api_url}/chat/completions",
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {self.api_key}"
                    },
                    json={
                        "model": model,
                        "messages": messages,
                        "stream": True,
                    },
                    timeout=3,  # 设置超时时间为3秒
                    stream=True,

                )

                if response.status_code == 200:
                    buffer = io.StringIO()
                    for chunk in response.iter_lines(decode_unicode=True):
                        if chunk:
                            try:
                                buffer.write(chunk)
                                data = json.loads(buffer.getvalue().strip('data:'))
                                buffer = io.StringIO()
                                if 'choices' in data and data['choices']:
                                    content = data['choices'][0]['delta'].get('content', '').strip()
                                    if content:
                                        yield f"{content}"
                            except json.JSONDecodeError:
                                continue
                            except KeyError as e:
                                logging.error(f"KeyError: {e}")
                    break  # 如果成功获取响应，则退出循环
            except requests.exceptions.Timeout:
                logging.warning(f"Model {model} timed out. Trying next model.")
            except requests.exceptions.RequestException as e:
                logging.error(f"RequestException with model {model}: {e}")


# 读取配置文件
with open('E:/python_study/MedGPT_api/config.json', 'r') as f:
    config = json.load(f)

backend_api = BackendApi(config)


@app.post("/conversation")
async def conversation(request: Request):
    return await backend_api.conversation(request)
