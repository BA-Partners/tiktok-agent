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


## Mac 本地上线：Ollama + 本 API 同机运行

如果你已经在 Mac 上完成：

```bash
ollama pull qwen2.5:7b
ollama run qwen2.5:7b "你好，用一句话介绍你自己"
```

并看到模型正常回答，说明 Ollama 和 `qwen2.5:7b` 已经可用。接下来不要输入说明文字里的 `Mac:`；那只是架构说明，不是命令。

在 Mac 上运行本项目时，推荐按下面顺序执行：

```bash
# 1. 保持 Ollama 服务运行。如果已经有 Ollama App 在后台运行，这一步可以跳过。
ollama serve
```

另开一个终端窗口，**先进入本项目目录**再执行。你刚才看到 `cp: .env.example: No such file or directory` 和 `Could not read package.json`，就是因为命令是在 `/Users/ajin` 目录执行的，而不是项目目录。

> zsh 提醒：macOS 的交互式 zsh 默认不一定把 `#` 当注释处理。下面标注“可直接复制”的命令块会避免使用 `#` 注释行，防止出现 `zsh: command not found: #`。


### 先确认你拿到的是包含本地 AI 功能的新版本

如果你刚从 GitHub 克隆后看到：

```text
ls: .env.example: No such file or directory
npm error Missing script: "doctor:local"
npm error Missing script: "api:local"
```

说明你当前 Mac 上的 `~/tiktok-agent` 还是旧版代码，通常是因为 GitHub 仓库的默认分支还没有合并本地 AI 这次 PR。不要继续在旧目录里执行 `npm run api:local`，因为旧版 `package.json` 里没有这个脚本。

进入项目目录后先检查这几个文件是否存在：

```bash
cd ~/tiktok-agent
ls .env.example scripts/local-doctor.mjs src/llm/ollama.mjs src/db/local.mjs
npm run | grep -E 'api:local|doctor:local'
```

如果这些文件或脚本不存在，请先任选一种方式更新到包含本地 AI 功能的新版本：

方式 1：如果这次改动已经合并到默认分支，执行：

```bash
cd ~/tiktok-agent
git pull
```

方式 2：如果这次改动还在 PR 中，先 checkout 对应 PR。注意：不要把 `<PR编号>` 原样输入到 zsh，尖括号会被 shell 当成重定向。比如 `gh pr list` 显示 `#2` 时，执行下面这组**可直接复制**的命令：

```bash
cd ~/tiktok-agent
gh pr list --repo BA-Partners/tiktok-agent
gh pr checkout 2 --repo BA-Partners/tiktok-agent
```

方式 3：使用本次构建生成的 `tiktok-agent-1.0.0.tgz` 包，执行：

```bash
rm -rf ~/tiktok-agent
mkdir -p ~/tiktok-agent
tar -xzf /path/to/tiktok-agent-1.0.0.tgz -C ~/tiktok-agent --strip-components=1
cd ~/tiktok-agent
```

确认 `.env.example`、`scripts/local-doctor.mjs` 和 `api:local` 都存在后，再继续执行后面的 `.env`、`npm install`、`npm run doctor:local` 和 `npm run api:local`。

#### 针对你当前输出的直接修复命令

如果 `gh pr list` 显示本地 AI 改动在 `#2`，并且你现在位于 `~/tiktok-agent`，直接执行下面这一组。不要再运行 `gh pr checkout <PR编号>`，也不要在当前目录里再次运行 `gh repo clone BA-Partners/tiktok-agent`，否则会在项目里套一个新的 `tiktok-agent/` 子目录。

下面是**没有 `#` 注释行、可直接复制到 zsh** 的修复命令：

```bash
cd ~/tiktok-agent
rm -rf ./tiktok-agent
gh pr checkout 2 --repo BA-Partners/tiktok-agent
ls .env.example scripts/local-doctor.mjs src/llm/ollama.mjs src/db/local.mjs
npm run | grep -E 'api:local|doctor:local'
cp .env.example .env
npm install
npm run doctor:local
npm run api:local
```


把 `/path/to/tiktok-agent` 替换成你实际保存项目的位置后，执行下面这组**可直接复制到 zsh** 的命令：

```bash
cd /path/to/tiktok-agent
pwd
ls package.json .env.example
cp .env.example .env
npm install
npm run doctor:local
npm run api:local
```

再另开一个终端窗口验证：

```bash
curl http://localhost:11434/api/tags
curl http://localhost:3000/v1/health
curl http://localhost:3000/v1/models
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claw-chat-v1",
    "messages": [
      { "role": "user", "content": "你好，用一句话介绍你自己" }
    ]
  }'
```


### 如果你还没有项目目录

如果你的 Mac 上还没有 `tiktok-agent` 项目目录，需要先把代码或打包文件放到本机。注意：`gh repo clone BA-Partners/tiktok-agent` 默认克隆 GitHub 仓库的默认分支；如果这次本地 AI 改动还没有合并到默认分支，克隆成功后仍然可能缺少 `.env.example`、`doctor:local` 和 `api:local`。

可以按下面三种方式任选一种。

#### 方式 A：不用 GitHub CLI，直接用 git clone

如果仓库对你的 Git 凭据可访问，优先用这个方式：

```bash
cd ~
git clone https://github.com/BA-Partners/tiktok-agent.git tiktok-agent
cd ~/tiktok-agent
```

如果这是私有仓库，`git clone` 可能会要求你输入 GitHub 用户名和 Personal Access Token，或者提示你没有权限。

#### 方式 B：先登录 GitHub CLI，再用 gh repo clone

如果你想继续用 `gh repo clone`，先完成 GitHub CLI 登录：

```bash
gh auth login
```

按提示选择 GitHub.com、HTTPS、浏览器登录。登录成功后再执行：

```bash
cd ~
gh repo clone BA-Partners/tiktok-agent tiktok-agent
cd ~/tiktok-agent
ls .env.example scripts/local-doctor.mjs
```

如果 `.env.example` 不存在，说明默认分支还没有合并本地 AI PR；请执行 `gh pr checkout 2 --repo BA-Partners/tiktok-agent` 或回到上面的“先确认你拿到的是包含本地 AI 功能的新版本”。

也可以用 token：

```bash
export GH_TOKEN=你的GitHubToken
gh repo clone BA-Partners/tiktok-agent tiktok-agent
cd ~/tiktok-agent
ls .env.example scripts/local-doctor.mjs
```

如果 `.env.example` 不存在，说明默认分支还没有合并本地 AI PR；请回到上面的“先确认你拿到的是包含本地 AI 功能的新版本”。

#### 方式 C：使用打包文件

如果你拿到的是 `tiktok-agent-1.0.0.tgz` 打包文件：

```bash
mkdir -p ~/tiktok-agent
tar -xzf /path/to/tiktok-agent-1.0.0.tgz -C ~/tiktok-agent --strip-components=1
cd ~/tiktok-agent
```

进入目录后，用下面命令确认目录正确：

```bash
pwd
ls package.json .env.example
```

确认无误后再执行 `cp .env.example .env`、`npm install` 和 `npm run api:local`。

### 远程服务连接你 Mac 上的 Ollama

Ollama 默认监听 `127.0.0.1:11434`，只允许本机访问。如果 API 服务不在你的 Mac 上运行，远程环境不能使用 `http://localhost:11434` 访问你的 Mac。

如果你确实要让远程 API 连接 Mac 上的 Ollama，需要先让 Ollama 监听外部地址，并使用真实可达的 IP、VPN 或隧道地址：

```bash
pkill ollama || true
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

然后把运行 API 的环境配置为真实地址，例如：

```env
OLLAMA_BASE_URL=http://你的Mac可达IP:11434
```

不要直接使用示例里的 `http://100.x.y.z:11434`；`100.x.y.z` 只是占位符，必须替换成真实 Tailscale/VPN/IP 地址。

> 安全提醒：不要把 `11434` 裸露到公网。优先使用 Tailscale、VPN 或带鉴权的隧道。

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
