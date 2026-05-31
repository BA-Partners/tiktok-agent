const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen2.5:7b';
const DEFAULT_TIMEOUT_MS = 120000;

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

export function getOllamaConfig() {
  return {
    baseUrl: trimTrailingSlash(process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL),
    model: process.env.OLLAMA_MODEL || DEFAULT_MODEL,
    timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  };
}

function normalizeMessages({ messages, message, system }) {
  if (Array.isArray(messages) && messages.length > 0) {
    return messages.map((item) => {
      if (!item || typeof item !== 'object') {
        throw new Error('messages 数组中的每一项都必须是对象');
      }

      const role = item.role || 'user';
      const content = item.content;

      if (!['system', 'user', 'assistant', 'tool'].includes(role)) {
        throw new Error(`不支持的消息角色: ${role}`);
      }

      if (typeof content !== 'string' || content.trim() === '') {
        throw new Error('messages 中的 content 必须是非空字符串');
      }

      return { role, content };
    });
  }

  if (typeof message !== 'string' || message.trim() === '') {
    throw new Error('请求体必须提供 message，或提供非空 messages 数组');
  }

  const normalized = [];
  if (typeof system === 'string' && system.trim() !== '') {
    normalized.push({ role: 'system', content: system });
  }
  normalized.push({ role: 'user', content: message });
  return normalized;
}

async function requestOllama(path, payload, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { baseUrl } = getOllamaConfig();
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama 请求失败: ${response.status} ${text}`);
    }

    return await response.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Ollama 请求超时，超过 ${timeoutMs}ms 未返回`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function chatWithOllama(input = {}) {
  const { model, timeoutMs } = getOllamaConfig();
  const messages = normalizeMessages(input);

  const data = await requestOllama('/api/chat', {
    model,
    messages,
    stream: false,
    options: input.options || undefined
  }, timeoutMs);

  return {
    provider: 'ollama',
    model,
    reply: data.message?.content || '',
    raw: data
  };
}

export async function checkOllamaHealth() {
  const { baseUrl, model, timeoutMs } = getOllamaConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(timeoutMs, 10000));

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama 健康检查失败: ${response.status} ${text}`);
    }

    const data = await response.json();
    const models = Array.isArray(data.models) ? data.models : [];
    const modelNames = models.map((item) => item.name);

    return {
      provider: 'ollama',
      baseUrl,
      model,
      available: true,
      modelInstalled: modelNames.includes(model),
      models: modelNames
    };
  } catch (err) {
    return {
      provider: 'ollama',
      baseUrl,
      model,
      available: false,
      modelInstalled: false,
      error: err.message
    };
  } finally {
    clearTimeout(timeout);
  }
}
