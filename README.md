# MedGPT

MedGPT 是一个专为医疗健康领域设计的AI助手，旨在帮助医护人员、医疗学生和普通用户快速获取专业的医疗建议和信息。

## 安装指南

1. **安装Python**（推荐3.8或更高版本）
2. **创建虚拟环境**:
   ```bash
   python -m venv venv
   ```
3. **激活虚拟环境**:
   - Windows:
     ```bash
     .\venv\Scripts\activate
     ``` 
   - Mac/Linux:
     ```bash
     source venv/bin/activate
     ```
4. **安装依赖**:
   ```bash
   pip install -r requirements.txt
   ```

## 使用方法

1. **启动程序**:
   ```bash
   python main.py
   ```
2. **输入医疗问题**:
   - 例如：“糖尿病的症状有哪些？”、“高血压患者的饮食建议？”
3. **获取专业回答**:
   - 程序将基于其医疗知识库提供详细而准确的回答

## 测试效果1：
<img width="1030" height="866" alt="6bba93310f50cb09dc59a10ae7f016d2" src="https://github.com/user-attachments/assets/1eff1512-8431-4845-acc7-5a8f78d00efd" />
<img width="1776" height="689" alt="image" src="https://github.com/user-attachments/assets/7004c1ea-4283-45dc-8751-9e67f689a47c" />
## 测试效果2：
<img width="1039" height="591" alt="80b1a49b415c53fbebd8758d0c6e5d7e" src="https://github.com/user-attachments/assets/44a89ee2-bbb4-4b14-a90b-5c36e2258004" />
<img width="712" height="430" alt="a15bfaeb38761670c2acb30140d74e0f" src="https://github.com/user-attachments/assets/c8e4e850-315a-48bd-a8ae-be8e2a5c0434" />

## 技术细节

- **模型基础**: 基于GPT模型架构，针对医疗领域进行了微调
- **数据来源**: 整合了权威医学文献、临床指南和医疗教育资料
- **安全机制**: 经过严格的医学验证，确保提供的信息准确可靠
- **学习机制**: 持续从最新医疗研究成果中学习，保持知识库更新

## 应用场景

- 门诊预诊断
- 医疗知识科普
- 医学生学习辅助
- 远程医疗咨询

## 贡献指南

欢迎医疗专业人士和开发人员参与改进，提交Pull Request前请先在Issues中讨论。

## 联系方式

感谢您对MedGPT的关注！
