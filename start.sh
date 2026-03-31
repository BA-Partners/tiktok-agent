#!/bin/bash

echo "🚀 TikTok Agent 启动中..."

# 检查环境变量
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "⚠️  环境变量未设置，加载 .env 文件..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# 检查 Playwright 浏览器
echo "🔍 检查浏览器..."
npx playwright install chromium 2>/dev/null || true

echo "✅ 准备就绪，开始运行..."
echo "📊 监控: https://supabase.com/dashboard"
echo ""

# 运行
node src/worker.mjs
