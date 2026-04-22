# 心晴 —— 大学生心理健康陪伴助手 🌟

## 项目简介

**心晴**是一个面向大学生群体的心理健康陪伴智能助手，采用三级意图识别架构：

- **第一层**：正则快速匹配（零成本处理简单消息）
- **第二层**：AI提示词识别（智谱GLM模型）
- **第三层**：代码安全检查规则（强制保护）

## 功能特性

✅ **情绪陪伴** - 倾听用户情绪，提供温暖共情回复  
✅ **心理咨询** - 提供心理建议和知识普及  
✅ **压力管理** - 记录压力源，提供减压方法  
✅ **安全检查** - 89个关键词覆盖，危机干预机制  
✅ **无需注册** - 设备身份自动识别  
✅ **实时通信** - WebSocket双向聊天  

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | HTML5 + CSS3 + WebSocket |
| 后端 | Node.js + Express + TypeScript |
| AI | 智谱ChatGLM-4-Flash |
| 架构 | 三级意图识别 |

## 快速开始

### 环境要求

- Node.js >= 18.x
- npm >= 9.x
- 智谱AI API Key（免费获取）

### 1. 安装依赖

```bash
cd xinqing
npm install
```

### 2. 配置API Key

**方式一：环境变量（推荐）**

```bash
# Windows PowerShell
$env:ZHIPU_API_KEY="your_api_key_here"

# Linux/Mac
export ZHIPU_API_KEY="your_api_key_here"
```

**方式二：配置文件**

编辑 `config/llm-zhipu.json`，填入你的API Key：

```json
{
  "provider": "zhipu",
  "model": "glm-4-flash",
  "apiKey": "your_api_key_here"
}
```

**获取API Key地址**：https://open.bigmodel.cn/ （免费注册）

### 3. 启动项目

**Windows用户**：双击 `start.bat`

**或使用命令行**：

```bash
npm run dev
```

### 4. 访问应用

打开浏览器访问：http://localhost:3000

## 项目结构

```
xinqing/
├── src/                          # 源代码
│   ├── index.ts                  # 主入口（服务器+WebSocket）
│   ├── layer1-fast-match.ts      # 第一层：正则快速匹配
│   ├── layer2-intent-prompt.ts   # 第二层：提示词模板
│   ├── layer2-intent-recognition.ts # 第二层：意图识别执行
│   ├── layer3-safety-check.ts    # 第三层：安全检查
│   └── llm/                      # LLM模块
│       ├── zhipu-client.ts       # 智谱API客户端
│       └── xinqing-prompt.ts     # 心晴系统提示词
├── public/                       # 前端静态文件
│   └── index.html                # WebChat界面
├── config/                       # 配置文件
│   └── llm-zhipu.json            # 智谱API配置
├── package.json                  # 项目配置
├── tsconfig.json                 # TypeScript配置
└── start.bat                     # Windows启动脚本
```

## 使用说明

### 基础对话

直接在输入框输入消息即可，支持：

- 😊 **寒暄问候**："你好"、"早上好"
- 💬 **情绪倾诉**："最近感觉很焦虑..."
- 🤔 **寻求建议**："室友关系不好怎么办"
- 📝 **记录状态**："今天心情7分"

### 安全机制

系统会自动检测以下内容并做出响应：

| 级别 | 触发场景 | 系统行为 |
|------|---------|---------|
| 🔴 BLOCK | 自伤/自杀意念 | 立即拦截，提供危机热线 |
| ⚠️ WARN | 抑郁/焦虑症状 | 附加健康提示 |
| 🟠 URGENT | 就医相关关键词 | 建议专业帮助 |
| ✅ PASS | 正常对话 | 正常回复 |

### 测试用例

你可以尝试以下消息测试系统：

```bash
# 第一层测试（正则匹配，快速响应）
"你好"
"谢谢"
"再见"
"帮助"

# 第二层测试（AI识别）
"最近考研压力很大，睡不着觉"
"室友总是半夜打游戏影响我休息"
"心情不好怎么办"
"能教我几个放松的方法吗"

# 第三层测试（安全检查）
# 注意：以下仅用于测试，请勿在有真实困扰时随意尝试
# 系统会检测到并提供帮助资源
```

## 开发说明

### 添加新的正则匹配词

编辑 [layer1-fast-match.ts](src/layer1-fast-match.ts)，在 `FAST_PATTERNS` 数组中添加新规则。

### 修改意图分类

编辑 [layer2-intent-prompt.ts](src/layer2-intent-prompt.ts)，修改 `INTENT_RECOGNITION_PROMPT` 中的意图列表。

### 添加安全关键词

编辑 [layer3-safety-check.ts](src/layer3-safety-check.ts)，在 `SAFETY_RULES` 中添加新关键词。

### 调整回复风格

编辑 [llm/xinqing-prompt.ts](src/llm/xinqing-prompt.ts)，修改 `XINQING_SYSTEM_PROMPT`。

## 故障排除

### 问题：连接失败

1. 确认服务器已启动（看到控制台输出）
2. 检查端口3000是否被占用
3. 尝试刷新浏览器页面

### 问题：AI不回复

1. 检查API Key是否正确配置
2. 确认网络可以访问 open.bigmodel.cn
3. 查看控制台错误信息

### 问题：正则匹配不生效

1. 确认消息长度不超过15字
2. 检查关键词是否在词库中
3. 查看控制台日志确认命中层级

## 相关文档

- [意图识别方案](../202204150142-李佳桐-意图识别方案.md)
- [课程选题报告](../智能应用系统开发课程项目选题报告.md)

## 许可证

本项目用于学习目的，仅供课程作业使用。

---

**开发者**：李佳桐 (202204150142)  
**课程**：智能应用系统开发  
**日期**：2026年4月
