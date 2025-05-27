from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Template
import os
from time import time
from os import urandom

class Website:
    def __init__(self, app: FastAPI) -> None:
        self.app = app
        self.setup_routes()

    def setup_routes(self):
        # 设置根路径的重定向
        self.app.add_route("/", self.redirect_to_chat, methods=["GET", "POST"])
        # 设置 chat 路由
        self.app.add_route("/chat/", self.index, methods=["GET", "POST"])
        self.app.add_route("/chat/{conversation_id}", self.chat, methods=["GET", "POST"])
        
        # 设置静态文件目录
        base_static_dir = os.path.abspath(r"E:\python_study\MedGPT_api\client")
        self.app.mount("/static/css", StaticFiles(directory=os.path.join(base_static_dir, "css")), name="css")
        self.app.mount("/static/js", StaticFiles(directory=os.path.join(base_static_dir, "js")), name="js")
        self.app.mount("/static/img", StaticFiles(directory=os.path.join(base_static_dir, "img")), name="img")

    async def redirect_to_chat(self, request: Request):
        return RedirectResponse(url="/chat")

    async def chat(self, request: Request, conversation_id: str):
        if '-' not in conversation_id:
            return RedirectResponse(url="/chat")
        return self.render_template('index.html', chat_id=conversation_id)

    async def index(self, request: Request):
        chat_id = f'{urandom(4).hex()}-{urandom(2).hex()}-{urandom(2).hex()}-{urandom(2).hex()}-{hex(int(time() * 1000))[2:]}'
        return self.render_template('index.html', chat_id=chat_id)

    def render_template(self, template_name: str, **context):
        # 使用绝对路径来加载模板文件
        template_path = os.path.abspath(f'E:/python_study/MedGPT_api/client/html/{template_name}')
        try:
            with open(template_path, encoding='utf-8') as f:
                template = Template(f.read())
            return HTMLResponse(template.render(**context))
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Template {template_name} not found in path {template_path}")
