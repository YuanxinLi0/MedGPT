import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from json import load
from server.backend import BackendApi
from server.website import Website

# 创建 FastAPI 实例
app = FastAPI()

# 加载配置
config_path = 'E:/python_study/MedGPT_api/config.json'
with open(config_path, 'r') as config_file:
    config = load(config_file)

site_config = config['site_config']

# 设置 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 实例化 BackendApi 和 Website
backend_api = BackendApi(config)
site = Website(app)

# 注册 BackendApi 的路由
@app.post("/backend-api/v2/conversation")
async def conversation_endpoint(request: Request):
    return await backend_api.conversation(request)

# 启动应用
if __name__ == '__main__':
    print(f"Running on port {site_config['port']}")
    uvicorn.run(app, host='127.0.0.1', port=site_config['port'], reload=site_config.get('debug', False))
