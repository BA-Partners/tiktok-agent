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

如果你看到 `/v1/health` 返回 `"status":"ok"`、`/v1/models` 返回 `claw-chat-v1`，并且 `/v1/chat/completions` 返回助手内容，说明本地 Ollama + OpenAI-compatible API 已经跑通。

也可以用自动冒烟测试验证同一组接口：

```bash
npm run smoke:local
```

冒烟测试会检查 `/v1/health`、`/v1/models` 和 `/v1/chat/completions`，全部通过时会输出 `Local API smoke test passed`。


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


### 常见问题：`/v1/health` 返回 503 或 API Key 没生效

如果你看到下面这种返回：

```json
{"status":"unavailable","provider":"ollama","baseUrl":"http://localhost:11434","model":"qwen2.5:7b","available":false,"modelInstalled":false,"error":"fetch failed"}
```

这表示 **API 服务已经在 `3000` 端口响应了，但它连不上本机 Ollama 的 `11434` 端口**。先在新终端检查 Ollama：

```bash
curl http://localhost:11434/api/tags
ollama list
```

如果连接失败，重新启动 Ollama：

```bash
ollama serve
```

如果 `ollama serve` 报下面这种错误：

```text
Error: mkdir /Volumes/EXTERNAL_USB/ollama_models: permission denied: ensure path elements are traversable
```

说明你的 Mac 环境里设置了 `OLLAMA_MODELS=/Volumes/EXTERNAL_USB/ollama_models`，但当前用户没有权限访问这个外接盘目录。最快修复是临时改回默认模型目录：

```bash
pkill ollama || true
unset OLLAMA_MODELS
launchctl unsetenv OLLAMA_MODELS
mkdir -p ~/.ollama/models
ollama serve
```

保持这个终端不要关，再开新终端确认：

```bash
curl http://localhost:11434/api/tags
ollama list
```

如果你必须继续把模型放在外接盘，则修复外接盘目录权限：

```bash
sudo mkdir -p /Volumes/EXTERNAL_USB/ollama_models
sudo chown -R "$USER":staff /Volumes/EXTERNAL_USB/ollama_models
chmod -R u+rwX /Volumes/EXTERNAL_USB/ollama_models
launchctl setenv OLLAMA_MODELS /Volumes/EXTERNAL_USB/ollama_models
ollama serve
```

保持 `ollama serve` 这个终端不要关，再另开一个终端重启 API：

```bash
cd ~/tiktok-agent
npm run api:local
```

如果你设置了 `LOCAL_API_KEY`，但不带 `Authorization` 访问仍然不是 `401`，通常说明 **API 是在设置 `.env` 之前启动的旧进程，或者本地分支还没有拉到 API Key 中间件代码**。按下面顺序重启并验证：

```bash
cd ~/tiktok-agent
grep LOCAL_API_KEY .env
grep requireLocalApiKey src/api/server.mjs
```

如果 `grep requireLocalApiKey src/api/server.mjs` 没有任何输出，说明你本地代码还没有拿到 API Key 中间件更新；先执行：

```bash
gh pr checkout 2 --repo BA-Partners/tiktok-agent
git pull
```

回到运行 API 的终端按 `Ctrl+C` 停止旧进程，然后重新启动：

```bash
npm run api:local
```

再另开终端验证。正确状态是：不带 key 返回 `401`，带 key 返回 `200` 或在 Ollama 未运行时返回 `503`。

```bash
cd ~/tiktok-agent
source .env
curl -i http://localhost:3000/v1/health
curl -i http://localhost:3000/v1/health -H "Authorization: Bearer $LOCAL_API_KEY"
```

如果第二条仍然是 `503`，说明鉴权已经通过，但 Ollama 还没启动或不可达；回到上面的 `ollama serve` 步骤。

### 从公网或远程环境访问你的 Mac API

如果只是你自己在 Mac 上使用，停在 `http://localhost:3000` 即可。如果要让我这个远程环境访问你的 Mac，需要先把 Mac 上的 API 暴露成一个远程可达地址。

**先开启 API Key，避免把本地 API 裸露到公网：**

```bash
cd ~/tiktok-agent
LOCAL_API_KEY_VALUE=$(openssl rand -hex 24)
cp .env .env.bak
awk -v key="$LOCAL_API_KEY_VALUE" 'BEGIN{done=0} /^LOCAL_API_KEY=/{print "LOCAL_API_KEY=" key; done=1; next} {print} END{if(!done) print "LOCAL_API_KEY=" key}' .env.bak > .env
grep LOCAL_API_KEY .env
```

重启 API：

```bash
npm run api:local
```

以后访问 API 时带上 header：

```bash
source .env
curl http://localhost:3000/v1/health -H "Authorization: Bearer $LOCAL_API_KEY"
```

#### 如果 Homebrew 报 `/usr/local/Homebrew is not writable`

如果 `brew install cloudflared` 或 `brew install ngrok` 报下面这种错误：

```text
Error: /usr/local/Homebrew is not writable
The following directories are not writable by your user
```

说明 Homebrew 目录 owner/权限不对。按 Homebrew 输出里的建议修复权限，然后重新安装：

```bash
sudo chown -R "$USER" /usr/local/Homebrew /usr/local/etc/bash_completion.d /usr/local/lib/pkgconfig /usr/local/share /usr/local/var/homebrew/locks /usr/local/var/log
chmod u+w /usr/local/Homebrew /usr/local/etc/bash_completion.d /usr/local/lib/pkgconfig /usr/local/share /usr/local/var/homebrew/locks /usr/local/var/log
```

如果 Homebrew 输出里列了更多目录，请优先复制 Homebrew 自己提示的完整 `sudo chown -R ...` 和 `chmod u+w ...` 命令。

修复后再试：

```bash
brew install ngrok
```

如果 Homebrew 继续报下面这种 cask 升级错误：

```text
Error: ngrok: Permission denied @ rb_file_s_rename - (/usr/local/Caskroom/ngrok/..., ...upgrading)
```

说明 `/usr/local/Caskroom` 或旧版 ngrok cask 目录也不是当前用户可写。修复 cask 目录后重新安装：

```bash
sudo chown -R "$USER" /usr/local/Caskroom /usr/local/bin/ngrok 2>/dev/null || true
chmod -R u+rwX /usr/local/Caskroom 2>/dev/null || true
brew reinstall ngrok
ngrok version
```

如果还是失败，可以先移除旧 cask 目录再重新安装：

```bash
sudo rm -rf /usr/local/Caskroom/ngrok
brew install ngrok
ngrok version
```

如果你不想修 Homebrew，也可以去 ngrok 官方下载页下载 macOS agent zip，解压后把 `ngrok` 放到用户目录，例如：

```bash
mkdir -p ~/bin
mv ~/Downloads/ngrok ~/bin/ngrok
chmod +x ~/bin/ngrok
export PATH="$HOME/bin:$PATH"
ngrok version
```

#### 方案 A：Cloudflare Tunnel（推荐临时测试）

Cloudflare 官方文档说明 macOS 可以通过 Homebrew 安装 `cloudflared`。安装后可以把本机 `localhost:3000` 临时暴露成一个 HTTPS 地址。

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
```

命令输出里会出现一个 `https://...trycloudflare.com` 地址。把这个地址发给我，我就可以测试：

```bash
source .env
curl https://你的地址.trycloudflare.com/v1/health -H "Authorization: Bearer $LOCAL_API_KEY"
```

停止 tunnel：回到运行 `cloudflared tunnel` 的终端按 `Ctrl+C`。

#### 方案 B：ngrok

ngrok 官方 quickstart 的 macOS 安装方式是 Homebrew，启动 HTTP tunnel 时把端口换成当前 API 的 `3000`。

```bash
brew install ngrok
ngrok config add-authtoken 你的ngrokToken
ngrok http 3000
```

注意：这里必须是 `ngrok http 3000`，因为本 API 运行在 `localhost:3000`。如果误运行了 `ngrok http 80`，ngrok 会把公网地址转发到 `localhost:80`，不会连到本项目 API；回到 ngrok 终端按 `Ctrl+C` 停止后，重新执行 `ngrok http 3000`。

`ngrok config add-authtoken ...` 里的 token 是敏感凭据，不要发到聊天或截图里。如果已经泄露，请到 ngrok Dashboard 里 revoke / rotate authtoken，然后重新执行 `ngrok config add-authtoken 新token`。

命令输出里会出现一个 `https://...ngrok-free.app` 或 `https://...ngrok-free.dev` 地址。带 API key 测试：

```bash
source .env
curl https://你的地址.ngrok-free.app/v1/health -H "Authorization: Bearer $LOCAL_API_KEY"
```

如果你的地址是 `.ngrok-free.dev`，就把上面的域名替换成实际输出的 `.ngrok-free.dev` 地址。

停止 tunnel：回到运行 `ngrok http 3000` 的终端按 `Ctrl+C`。

#### 方案 C：Tailscale Funnel

Tailscale 官方文档说明 `tailscale funnel` 可以把本机服务暴露到公网，也可以用 `tailscale serve` 只在 tailnet 内共享。Funnel 可直接反向代理本机服务端口：

```bash
tailscale funnel localhost:3000
tailscale funnel status
```

如果你只想在自己的 tailnet 内访问，不想公开到互联网，优先使用：

```bash
tailscale serve localhost:3000
tailscale serve status
```

停止 Funnel：

```bash
tailscale funnel reset
```

> 安全提醒：无论使用 Cloudflare Tunnel、ngrok 还是 Tailscale Funnel，都建议只临时开启，并设置 `LOCAL_API_KEY`。测试完成后关闭 tunnel。

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
