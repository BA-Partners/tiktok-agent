# TikTok Agent

自动化 TikTok 互动机器人

## 功能
- ✅ 观看视频（随机时长）
- ✅ 点赞视频（30%概率）
- ✅ 浏览评论区
- ✅ 点赞评论（30%概率，每次2条）
- ✅ 数据记录到本地 SQLite

## 快速启动

```bash
# 安装依赖
npm install

# 启动
npm start

# 或直接运行
./start.sh
```

## 环境配置

在 `.env` 文件中设置：

```
# 本地 SQLite 数据库（可选，默认 data/app.sqlite）
SQLITE_DB_PATH=data/app.sqlite

# 本地 Ollama AI 接口（可选）
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_TIMEOUT_MS=120000

# 对外展示的模型名（可选，默认等于 OLLAMA_MODEL）
PUBLIC_MODEL_NAME=claw-chat-v1

# 本地知识库 RAG（可选）
RAG_ENABLED=true
RAG_KB_DIR=knowledge
RAG_TOP_K=4
RAG_CHUNK_SIZE=1200
```

## 本地 Ollama AI

项目提供了一个本地 Ollama 对话接口，不需要 OpenAI API Key。

### 准备 Ollama

```bash
# 安装 Ollama 后拉取模型
ollama pull qwen2.5:7b

# 如果服务没有自动启动，可以手动启动
ollama serve
```

### 健康检查

```bash
curl http://localhost:3000/api/llm/health
```

### 本地对话

```bash
curl http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"你好，用一句话介绍你自己"}'
```

也可以传入 OpenAI 风格的 `messages` 数组：

```json
{
  "messages": [
    { "role": "system", "content": "你是一个中文助手。" },
    { "role": "user", "content": "写一条短文案" }
  ]
}
```

## OpenAI-compatible API

项目也提供 OpenAI-compatible 接口，可以把本服务当成本地 OpenAI 替代服务使用。

### 查看健康状态

```bash
curl http://localhost:3000/v1/health
```

### 查看模型列表

```bash
curl http://localhost:3000/v1/models
```

### Chat Completions

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claw-chat-v1",
    "messages": [
      { "role": "system", "content": "你是我的本地中文助手。" },
      { "role": "user", "content": "你好，用一句话介绍你自己" }
    ]
  }'
```

### Responses-style API

```bash
curl http://localhost:3000/v1/responses \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claw-chat-v1",
    "input": "你好，用一句话介绍你自己"
  }'
```

> 当前 OpenAI-compatible 接口使用非流式响应，`stream=true` 暂未支持。

## 本地知识库 RAG

项目默认会从 `knowledge/` 目录读取 `.md`、`.markdown`、`.txt`、`.json` 文件，并在 `/v1/chat/completions` 和 `/v1/responses` 调用 Ollama 前注入相关上下文。

### 查看 RAG 状态

```bash
curl http://localhost:3000/api/rag/health
```

### 搜索知识库

```bash
curl "http://localhost:3000/api/rag/search?q=OpenAI-compatible"
```

### 在 Chat Completions 中使用或关闭 RAG

默认启用 RAG。可以在请求体里设置 `rag: false` 临时关闭，或设置 `rag_top_k` 控制召回片段数量。

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claw-chat-v1",
    "rag_top_k": 3,
    "messages": [
      { "role": "user", "content": "这个服务有哪些 OpenAI-compatible 接口？" }
    ]
  }'
```

### 训练和专属模型版本

当前服务已经完成“API 网关 + Ollama 后端 + 本地 RAG + 专属公开模型名”的在线版本。真正的 LoRA/QLoRA 微调需要你提供训练数据，并在有 GPU 的训练环境中执行；微调完成后，可以继续通过同一套 `/v1/*` API 暴露新的专属模型版本。

> 注意：API 服务和 worker 默认使用本地 SQLite，`src/register.mjs` 中的历史批量注册脚本仍保留原有 Supabase 逻辑。

## 本地 SQLite 数据库

API 服务启动或首次写入时会自动创建 `SQLITE_DB_PATH` 指向的数据库文件。默认路径是 `data/app.sqlite`。本地数据库使用 Node.js 内置 `node:sqlite` 模块，建议使用 Node.js 22.5+。

### 健康检查

```bash
curl http://localhost:3000/api/storage/health
```

### 自动创建的数据表

- `agent_users`: 用户邮箱和 API token
- `agent_tiktok_accounts`: 用户绑定的 TikTok 账号和 Cookie
- `agent_task_logs`: 任务启动/停止日志
- `agent_action_logs`: 运行中的动作日志
- `comment_logs`: 评论区相关动作日志

## 安全提示

- 不要在公共场合运行
- 建议使用多个账号轮换
- 控制运行时间避免封号
