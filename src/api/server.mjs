import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { chatWithOllama, checkOllamaHealth } from '../llm/ollama.mjs';
import {
  createChatCompletion,
  createOpenAiCompatibleError,
  createResponse,
  listOpenAiCompatibleModels
} from '../llm/openai-compatible.mjs';
import {
  createTikTokAccount,
  createUser,
  findTikTokAccount,
  findUserByCredentials,
  findUserByEmail,
  getLocalDbInfo,
  getUserStats,
  insertActionLog,
  insertTaskLog,
  listTikTokAccounts,
  updateTikTokAccountStatus
} from '../db/local.mjs';

const app = express();
app.use(cors());
app.use(express.json());

const workers = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateAccountDir(userId, tiktokId) {
  const baseDir = './accounts';
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  const accountDir = `${baseDir}/${userId}_${tiktokId}`;
  if (!fs.existsSync(accountDir)) {
    fs.mkdirSync(accountDir, { recursive: true });
  }
  return accountDir;
}


function sendOpenAiCompatibleError(res, err) {
  if (err?.body?.error && err.status) {
    return res.status(err.status).json(err.body);
  }

  const compatibleError = createOpenAiCompatibleError(err.message || 'Unknown error');
  return res.status(compatibleError.status).json(compatibleError.body);
}

// OpenAI-compatible health endpoint
app.get('/v1/health', async (req, res) => {
  const health = await checkOllamaHealth();
  res.status(health.available ? 200 : 503).json({
    status: health.available ? 'ok' : 'unavailable',
    ...health
  });
});

// OpenAI-compatible model list
app.get('/v1/models', (req, res) => {
  res.json(listOpenAiCompatibleModels());
});

// OpenAI-compatible Chat Completions API
app.post('/v1/chat/completions', async (req, res) => {
  try {
    res.json(await createChatCompletion(req.body || {}));
  } catch (err) {
    sendOpenAiCompatibleError(res, err);
  }
});

// OpenAI-compatible Responses-style API
app.post('/v1/responses', async (req, res) => {
  try {
    res.json(await createResponse(req.body || {}));
  } catch (err) {
    sendOpenAiCompatibleError(res, err);
  }
});

// 本地存储健康检查
app.get('/api/storage/health', (req, res) => {
  res.json({ success: true, ...getLocalDbInfo() });
});

// 本地 Ollama AI 对话接口
app.post('/api/llm/chat', async (req, res) => {
  try {
    const result = await chatWithOllama(req.body || {});
    res.json({
      success: true,
      provider: result.provider,
      model: result.model,
      reply: result.reply
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Ollama 服务健康检查
app.get('/api/llm/health', async (req, res) => {
  const health = await checkOllamaHealth();
  res.status(health.available ? 200 : 503).json(health);
});

// 1. 用户注册
app.post('/api/register', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: '邮箱不能为空' });
    }

    const existing = findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: '邮箱已注册' });
    }

    const token = generateToken();
    const data = createUser({ email, token });

    res.json({ success: true, userId: data.id, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. 用户登录
app.post('/api/login', async (req, res) => {
  try {
    const { email, api_token } = req.body;
    const data = findUserByCredentials({ email, apiToken: api_token });

    if (!data) {
      return res.status(401).json({ error: '登录失败' });
    }

    res.json({ success: true, userId: data.id, token: data.api_token });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// 3. 添加 TikTok 账号
app.post('/api/tiktok-accounts', async (req, res) => {
  try {
    const { userId, name, cookies } = req.body;

    if (!userId || !name) {
      return res.status(400).json({ error: 'userId 和 name 不能为空' });
    }

    const data = createTikTokAccount({ userId, name, cookies });
    res.json({ success: true, accountId: data.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. 获取用户的 TikTok 账号列表
app.get('/api/tiktok-accounts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    res.json({ accounts: listTikTokAccounts(userId) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. 启动任务
app.post('/api/start-task', async (req, res) => {
  try {
    const { userId, accountId } = req.body;

    if (workers.has(accountId)) {
      return res.status(400).json({ error: '任务已在运行' });
    }

    // 获取账号信息
    const account = findTikTokAccount({ userId, accountId });
    if (!account) throw new Error('账号不存在');

    // 创建浏览器配置目录
    const accountDir = generateAccountDir(userId, accountId);

    // 注入 Cookie
    const cookies = JSON.parse(account.cookies || '[]');
    if (cookies.length > 0) {
      const cookieContent = cookies.map(c =>
        `${c.domain}\t${c.hostOnly?'TRUE':'FALSE'}\t${c.path}\t${c.secure?'TRUE':'FALSE'}\t${c.expires || -1}\t${c.name}\t${c.value}`
      ).join('\n');
      fs.writeFileSync(path.join(accountDir, 'cookies.txt'), cookieContent);
    }

    // 更新账号状态
    updateTikTokAccountStatus({
      accountId,
      status: 'running',
      lastUsed: new Date().toISOString()
    });

    // 记录启动
    insertTaskLog({ userId, accountId, action: 'start' });

    // 启动 worker 进程
    const worker = spawn('node', ['src/worker.mjs', accountDir], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ACCOUNT_ID: accountId.toString(), USER_ID: userId.toString() }
    });

    workers.set(accountId, {
      process: worker,
      userId,
      accountId,
      startTime: Date.now()
    });

    worker.stdout.on('data', async (data) => {
      const log = data.toString();
      console.log(`[Worker ${accountId}]`, log);

      // 记录日志
      if (log.includes('点赞')) {
        try {
          insertActionLog({
            userId,
            accountId,
            action: 'like',
            details: log.trim()
          });
        } catch {}
      }
    });

    worker.stderr.on('data', (data) => {
      console.error(`[Worker ${accountId} Error]`, data.toString());
    });

    worker.on('exit', async (code) => {
      workers.delete(accountId);
      try {
        updateTikTokAccountStatus({ accountId, status: 'stopped' });
      } catch (err) {
        console.error(`[Worker ${accountId} Status Error]`, err.message);
      }
    });

    res.json({ success: true, message: '任务已启动' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. 停止任务
app.post('/api/stop-task', async (req, res) => {
  try {
    const { userId, accountId } = req.body;

    const worker = workers.get(accountId);
    if (!worker) {
      return res.status(400).json({ error: '任务未运行' });
    }

    worker.process.kill();
    workers.delete(accountId);

    updateTikTokAccountStatus({ accountId, status: 'stopped' });
    insertTaskLog({ userId, accountId, action: 'stop' });

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 7. 获取用户统计
app.get('/api/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const stats = getUserStats(userId);

    res.json({
      ...stats,
      runningWorkers: Array.from(workers.keys())
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
});
