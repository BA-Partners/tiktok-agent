import 'dotenv/config';
const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const PUBLIC_MODEL_NAME = process.env.PUBLIC_MODEL_NAME || 'claw-chat-v1';
const LOCAL_API_KEY = process.env.LOCAL_API_KEY || process.env.API_KEY || '';

function ok(message) {
  console.log(`✅ ${message}`);
}

function fail(message) {
  console.log(`❌ ${message}`);
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Expected JSON but received: ${text.slice(0, 300)}`);
  }
}

function withAuthHeaders(headers = {}) {
  return LOCAL_API_KEY ? { ...headers, Authorization: `Bearer ${LOCAL_API_KEY}` } : headers;
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: withAuthHeaders(options.headers)
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  console.log(`Local API smoke test: ${API_BASE_URL}`);

  const health = await requestJson('/v1/health');
  if (health.status !== 'ok' || !health.available) {
    throw new Error(`/v1/health did not report ok: ${JSON.stringify(health)}`);
  }
  ok(`/v1/health ok with provider=${health.provider} model=${health.model}`);

  const models = await requestJson('/v1/models');
  const modelIds = Array.isArray(models.data) ? models.data.map((model) => model.id) : [];
  if (!modelIds.includes(PUBLIC_MODEL_NAME)) {
    throw new Error(`/v1/models did not include ${PUBLIC_MODEL_NAME}: ${modelIds.join(', ')}`);
  }
  ok(`/v1/models includes ${PUBLIC_MODEL_NAME}`);

  const completion = await requestJson('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: PUBLIC_MODEL_NAME,
      messages: [{ role: 'user', content: '你好，用一句话介绍你自己' }]
    })
  });
  const reply = completion.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error(`/v1/chat/completions returned no assistant reply: ${JSON.stringify(completion)}`);
  }
  ok(`/v1/chat/completions returned reply: ${reply}`);

  ok('Local API smoke test passed');
}

main().catch((err) => {
  fail(err.message);
  process.exitCode = 1;
});
