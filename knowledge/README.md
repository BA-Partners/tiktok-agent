# Local Knowledge Base

This directory is the default local RAG knowledge base for the TikTok Agent AI service.

Add `.md`, `.txt`, `.markdown`, or `.json` files here to make the OpenAI-compatible API retrieve local context before calling the model.

## Current platform facts

- The service exposes OpenAI-compatible endpoints at `/v1/models`, `/v1/chat/completions`, and `/v1/responses`.
- The default public model name is `claw-chat-v1`.
- The default model backend is Ollama at `http://localhost:11434`.
- The default local storage backend is SQLite at `data/app.sqlite`.
- The RAG knowledge base defaults to the `knowledge/` directory.

## Roadmap

1. OpenAI-compatible API gateway.
2. Ollama, OpenClaw, or vLLM model backends.
3. Local knowledge base RAG.
4. Curated training data export.
5. LoRA or QLoRA fine-tuning outside this Node.js service.
6. Deploy the tuned model behind the same OpenAI-compatible API.
