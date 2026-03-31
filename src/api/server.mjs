import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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

// 1. 用户注册
app.post('/api/register', async (req, res) => {
  try {
    const { email } = req.body;
    
    // 检查邮箱是否已存在
    const { data: existing } = await supabase
      .from('agent_users')
      .select('id')
      .eq('email', email)
      .single();
    
    if (existing) {
      return res.status(400).json({ error: '邮箱已注册' });
    }
    
    const token = generateToken();
    const { data, error } = await supabase
      .from('agent_users')
      .insert({ email, api_token: token })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, userId: data.id, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. 用户登录
app.post('/api/login', async (req, res) => {
  try {
    const { email, api_token } = req.body;
    
    const { data, error } = await supabase
      .from('agent_users')
      .select('*')
      .eq('email', email)
      .eq('api_token', api_token)
      .single();
    
    if (error || !data) {
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
    
    const { data, error } = await supabase
      .from('agent_tiktok_accounts')
      .insert({
        user_id: userId,
        name,
        cookies: JSON.stringify(cookies),
        status: 'active'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, accountId: data.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. 获取用户的 TikTok 账号列表
app.get('/api/tiktok-accounts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('agent_tiktok_accounts')
      .select('id, name, status, created_at')
      .eq('user_id', userId);
    
    if (error) throw error;
    res.json({ accounts: data || [] });
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
    const { data: account } = await supabase
      .from('agent_tiktok_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single();
    
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
    await supabase.from('agent_tiktok_accounts')
      .update({ status: 'running', last_used: new Date().toISOString() })
      .eq('id', accountId);
    
    // 记录启动
    await supabase.from('agent_task_logs').insert({
      user_id: userId,
      account_id: accountId,
      action: 'start'
    });
    
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
        await supabase.from('agent_action_logs').insert({
          user_id: userId,
          account_id: accountId,
          action: 'like',
          details: log.trim()
        }).catch(() => {});
      }
    });
    
    worker.stderr.on('data', (data) => {
      console.error(`[Worker ${accountId} Error]`, data.toString());
    });
    
    worker.on('exit', async (code) => {
      workers.delete(accountId);
      await supabase.from('agent_tiktok_accounts')
        .update({ status: 'stopped' })
        .eq('id', accountId);
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
    
    await supabase.from('agent_tiktok_accounts')
      .update({ status: 'stopped' })
      .eq('id', accountId);
    
    await supabase.from('agent_task_logs').insert({
      user_id: userId,
      account_id: accountId,
      action: 'stop'
    });
    
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 7. 获取用户统计
app.get('/api/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data: actions } = await supabase
      .from('agent_action_logs')
      .select('action, count(*)')
      .eq('user_id', userId)
      .groupBy('action');
    
    const { data: tasks } = await supabase
      .from('agent_task_logs')
      .select('action, count(*)')
      .eq('user_id', userId)
      .groupBy('action');
    
    res.json({ 
      actions: actions || [],
      tasks: tasks || [],
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
