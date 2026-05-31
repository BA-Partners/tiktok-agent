import { chatWithOllama, getOllamaConfig } from './ollama.mjs';

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getUnixTimestamp() {
  return Math.floor(Date.now() / 1000);
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

function estimateMessageTokens(messages = []) {
  return messages.reduce((total, message) => total + estimateTokens(message.content) + 4, 0);
}

function getPublicModelName(requestedModel) {
  return requestedModel || process.env.PUBLIC_MODEL_NAME || process.env.OLLAMA_MODEL || getOllamaConfig().model;
}

function normalizeOpenAiMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages must be a non-empty array');
  }

  return messages.map((message) => {
    if (!message || typeof message !== 'object') {
      throw new Error('each message must be an object');
    }

    const role = message.role || 'user';
    const content = message.content;

    if (!['system', 'user', 'assistant', 'tool'].includes(role)) {
      throw new Error(`unsupported message role: ${role}`);
    }

    if (typeof content === 'string') {
      if (content.trim() === '') {
        throw new Error('message content must not be empty');
      }
      return { role, content };
    }

    if (Array.isArray(content)) {
      const text = content
        .filter((part) => part?.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n')
        .trim();

      if (!text) {
        throw new Error('only text content parts are supported');
      }
      return { role, content: text };
    }

    throw new Error('message content must be a string or an array of text parts');
  });
}

export function listOpenAiCompatibleModels() {
  const model = getPublicModelName();
  return {
    object: 'list',
    data: [
      {
        id: model,
        object: 'model',
        created: 0,
        owned_by: 'local'
      }
    ]
  };
}

export function createOpenAiCompatibleError(message, type = 'invalid_request_error', status = 400) {
  return {
    status,
    body: {
      error: {
        message,
        type,
        param: null,
        code: null
      }
    }
  };
}

export async function createChatCompletion(requestBody = {}) {
  if (requestBody.stream) {
    throw createOpenAiCompatibleError('stream=true is not supported yet');
  }

  const messages = normalizeOpenAiMessages(requestBody.messages);
  const model = getPublicModelName(requestBody.model);
  const result = await chatWithOllama({
    messages,
    options: requestBody.options
  });

  const promptTokens = estimateMessageTokens(messages);
  const completionTokens = estimateTokens(result.reply);

  return {
    id: createId('chatcmpl'),
    object: 'chat.completion',
    created: getUnixTimestamp(),
    model,
    provider: result.provider,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: result.reply
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    }
  };
}

export async function createResponse(requestBody = {}) {
  if (requestBody.stream) {
    throw createOpenAiCompatibleError('stream=true is not supported yet');
  }

  const input = requestBody.input;
  const messages = Array.isArray(input)
    ? normalizeOpenAiMessages(input)
    : normalizeOpenAiMessages([{ role: 'user', content: String(input || '') }]);

  const model = getPublicModelName(requestBody.model);
  const result = await chatWithOllama({
    messages,
    options: requestBody.options
  });

  const promptTokens = estimateMessageTokens(messages);
  const completionTokens = estimateTokens(result.reply);

  return {
    id: createId('resp'),
    object: 'response',
    created_at: getUnixTimestamp(),
    status: 'completed',
    model,
    provider: result.provider,
    output_text: result.reply,
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: result.reply
          }
        ]
      }
    ],
    usage: {
      input_tokens: promptTokens,
      output_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    }
  };
}
