# TikTok Agent

自动化 TikTok 互动机器人

## 功能
- ✅ 观看视频（随机时长）
- ✅ 点赞视频（30%概率）
- ✅ 浏览评论区
- ✅ 点赞评论（30%概率，每次2条）
- ✅ 数据记录到 Supabase

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
SUPABASE_URL=你的Supabase URL
SUPABASE_ANON_KEY=你的Publishable Key
```

## 数据表

自动创建的表 `comment_logs`：
- `account`: 账号目录
- `video_url`: 视频链接
- `content`: 操作内容
- `status`: success/failed
- `created_at`: 时间戳

## 安全提示

- 不要在公共场合运行
- 建议使用多个账号轮换
- 控制运行时间避免封号
