import fs from 'fs';
import path from 'path';

const DEFAULT_KB_DIR = 'knowledge';
const DEFAULT_TOP_K = 4;
const DEFAULT_CHUNK_SIZE = 1200;
const SUPPORTED_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.json']);

function getRagConfig() {
  return {
    enabled: process.env.RAG_ENABLED !== 'false',
    knowledgeDir: process.env.RAG_KB_DIR || DEFAULT_KB_DIR,
    topK: Number(process.env.RAG_TOP_K || DEFAULT_TOP_K),
    chunkSize: Number(process.env.RAG_CHUNK_SIZE || DEFAULT_CHUNK_SIZE)
  };
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(fullPath);
    if (!entry.isFile()) return [];
    return SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ? [fullPath] : [];
  });
}

function chunkText(text, chunkSize) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) return [];

  const chunks = [];
  for (let index = 0; index < normalized.length; index += chunkSize) {
    chunks.push(normalized.slice(index, index + chunkSize));
  }
  return chunks;
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .match(/[\p{L}\p{N}_-]+/gu) || [];
}

function scoreChunk(queryTokens, chunk) {
  if (queryTokens.length === 0) return 0;

  const haystack = chunk.content.toLowerCase();
  const uniqueTokens = new Set(queryTokens);
  let score = 0;

  for (const token of uniqueTokens) {
    if (token.length <= 1) continue;
    const occurrences = haystack.split(token).length - 1;
    if (occurrences > 0) {
      score += occurrences * Math.min(token.length, 12);
    }
  }

  return score;
}

export function loadKnowledgeBase() {
  const config = getRagConfig();
  const files = walkFiles(config.knowledgeDir);
  const chunks = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);
    const fileChunks = chunkText(content, config.chunkSize);

    fileChunks.forEach((chunk, index) => {
      chunks.push({
        id: `${relativePath}#${index + 1}`,
        source: relativePath,
        chunk: index + 1,
        content: chunk
      });
    });
  }

  return {
    enabled: config.enabled,
    knowledgeDir: config.knowledgeDir,
    files: files.map((filePath) => path.relative(process.cwd(), filePath)),
    chunks
  };
}

export function searchKnowledge(query, options = {}) {
  const config = getRagConfig();
  if (!config.enabled) {
    return { enabled: false, query, sources: [] };
  }

  const { chunks } = loadKnowledgeBase();
  const queryTokens = tokenize(query);
  const topK = Number(options.topK || config.topK);

  const sources = chunks
    .map((chunk) => ({ ...chunk, score: scoreChunk(queryTokens, chunk) }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return {
    enabled: true,
    query,
    sources
  };
}

function getLastUserText(messages) {
  const lastUser = [...messages].reverse().find((message) => message.role === 'user');
  return lastUser?.content || '';
}

function buildContextMessage(sources) {
  const context = sources
    .map((source, index) => `[${index + 1}] ${source.source}#${source.chunk}\n${source.content}`)
    .join('\n\n');

  return {
    role: 'system',
    content: [
      'Use the following local knowledge base context when it is relevant.',
      'If the context does not answer the user, say you do not know from the local knowledge base and answer with general reasoning only when appropriate.',
      'When using context, mention the source id like [1] or [2].',
      '',
      context
    ].join('\n')
  };
}

export function augmentMessagesWithRag(messages, options = {}) {
  const config = getRagConfig();
  if (!config.enabled || options.rag === false) {
    return { messages, rag: { enabled: false, sources: [] } };
  }

  const query = options.query || getLastUserText(messages);
  const rag = searchKnowledge(query, { topK: options.topK });
  if (rag.sources.length === 0) {
    return { messages, rag };
  }

  return {
    messages: [buildContextMessage(rag.sources), ...messages],
    rag
  };
}

export function getRagHealth() {
  const kb = loadKnowledgeBase();
  return {
    enabled: kb.enabled,
    knowledgeDir: kb.knowledgeDir,
    files: kb.files.length,
    chunks: kb.chunks.length,
    supportedExtensions: Array.from(SUPPORTED_EXTENSIONS)
  };
}
