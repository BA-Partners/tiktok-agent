import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const REQUIRED_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');

function ok(message) {
  console.log(`✅ ${message}`);
}

function warn(message) {
  console.log(`⚠️  ${message}`);
}

function fail(message) {
  console.log(`❌ ${message}`);
}

function exists(relativePath) {
  return fs.existsSync(path.resolve(process.cwd(), relativePath));
}


function checkOllamaModelsDir() {
  const modelsDir = process.env.OLLAMA_MODELS;
  if (!modelsDir) {
    return true;
  }

  const resolved = path.resolve(modelsDir);
  try {
    fs.mkdirSync(resolved, { recursive: true });
    fs.accessSync(resolved, fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK);
    ok(`OLLAMA_MODELS is writable: ${resolved}`);
    return true;
  } catch (err) {
    fail(`OLLAMA_MODELS is not writable: ${resolved}`);
    warn(`Ollama may fail to start with: mkdir ${resolved}: permission denied`);
    warn('Either unset OLLAMA_MODELS to use ~/.ollama/models, or fix ownership/permissions on that directory.');
    warn('Reset example: unset OLLAMA_MODELS && launchctl unsetenv OLLAMA_MODELS && mkdir -p ~/.ollama/models');
    return false;
  }
}

async function checkOllama() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      fail(`Ollama responded with HTTP ${response.status} at ${OLLAMA_BASE_URL}`);
      return false;
    }

    const data = await response.json();
    const models = Array.isArray(data.models) ? data.models.map((model) => model.name) : [];
    ok(`Ollama is reachable at ${OLLAMA_BASE_URL}`);

    if (models.includes(REQUIRED_MODEL)) {
      ok(`Required model is installed: ${REQUIRED_MODEL}`);
    } else {
      warn(`Required model is not installed: ${REQUIRED_MODEL}`);
      warn(`Run: ollama pull ${REQUIRED_MODEL}`);
      if (models.length > 0) {
        warn(`Installed models: ${models.join(', ')}`);
      }
      return false;
    }

    return true;
  } catch (err) {
    fail(`Cannot reach Ollama at ${OLLAMA_BASE_URL}: ${err.message}`);
    warn('If Ollama is on this Mac, start it with: ollama serve');
    return false;
  }
}

console.log('Local deployment preflight');
console.log(`Current directory: ${process.cwd()}`);

let passed = true;

if (exists('package.json')) {
  ok('package.json found');
} else {
  fail('package.json not found. You are not in the tiktok-agent project directory.');
  warn('Run: cd /path/to/tiktok-agent');
  passed = false;
}

if (exists('.env.example')) {
  ok('.env.example found');
} else {
  fail('.env.example not found. Pull the latest code or unpack the release tarball first.');
  passed = false;
}

if (exists('.env')) {
  ok('.env found');
} else {
  warn('.env not found. Run: cp .env.example .env');
}

const ollamaModelsDirOk = checkOllamaModelsDir();
passed = passed && ollamaModelsDirOk;

const ollamaOk = await checkOllama();
passed = passed && ollamaOk;

if (passed) {
  ok('Preflight passed. Start the API with: npm run api:local');
} else {
  warn('Preflight found issues. Fix the messages above, then run this command again.');
  process.exitCode = 1;
}
