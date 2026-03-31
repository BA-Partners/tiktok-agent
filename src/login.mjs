import { createBrowser } from './browser.mjs';

async function login() {
  const { page } = await createBrowser('accounts/acc1');

  console.log('👉 打开 TikTok');

  await page.goto('https://www.tiktok.com', {
    timeout: 120000,
    waitUntil: 'domcontentloaded'
  });

  console.log('⚠️ 请手动完成登录（验证码/滑块）');

  // 给你足够时间手动操作
  await page.waitForTimeout(120000);

  console.log('✅ 登录信息已保存（cookies/session）');
}

login();
