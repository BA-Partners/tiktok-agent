import 'dotenv/config';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// 随机用户名生成
const firstNames = ['alex', 'mike', 'john', 'sarah', 'emma', 'lisa', 'david', 'james', 'emma', 'sophia', 'olivia', 'liam', 'noah', 'ethan', 'mason'];
const lastNames = ['smith', 'johnson', 'brown', 'taylor', 'wilson', 'davis', 'miller', 'jones', 'garcia', 'martinez'];
const suffixes = ['2024', 'pro', 'hub', 'channel', 'official', 'tv', 'media', 'daily', 'viral', 'trending'];

function generateUsername() {
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  const num = Math.floor(Math.random() * 999);
  return `${first}${last}${suffix}${num}`;
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

function generateEmail(username) {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'mail.com'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${username}@${domain}`;
}

async function registerAccount(profile) {
  const { browser, context, page } = await chromium.launchPersistentContext(
    `./accounts/${profile.username}`,
    { headless: false }
  );

  try {
    console.log(`📝 开始注册: ${profile.username}`);
    
    // 访问注册页面
    await page.goto('https://www.tiktok.com/signup', { timeout: 60000 });
    await page.waitForTimeout(3000);

    // 点击邮箱注册
    const emailBtn = page.locator('text=Use phone / email / username').first();
    if (await emailBtn.count() > 0) {
      await emailBtn.click();
      await page.waitForTimeout(1000);
    }

    // 选择邮箱注册
    const emailTab = page.locator('text=Email').first();
    if (await emailTab.count() > 0) {
      await emailTab.click();
      await page.waitForTimeout(1000);
    }

    // 输入邮箱
    await page.fill('input[type="email"], input[placeholder*="email" i]', profile.email);
    await page.waitForTimeout(500);

    // 点击继续
    const continueBtn = page.locator('button:has-text("Continue")').first();
    if (await continueBtn.count() > 0) {
      await continueBtn.click();
      await page.waitForTimeout(2000);
    }

    // 输入生日
    await page.fill('input[placeholder*="birthday" i], input[placeholder*="生日" i]', '1995-06-15');
    await page.waitForTimeout(500);

    // 继续
    if (await continueBtn.count() > 0) {
      await continueBtn.click();
      await page.waitForTimeout(2000);
    }

    // 输入用户名
    await page.fill('input[placeholder*="username" i]', profile.username);
    await page.waitForTimeout(1000);

    // 输入密码
    await page.fill('input[type="password"]', profile.password);
    await page.waitForTimeout(500);

    // 点击注册
    const signupBtn = page.locator('button:has-text("Sign up")').first();
    if (await signupBtn.count() > 0) {
      await signupBtn.click();
      await page.waitForTimeout(5000);
    }

    // 等待验证码（这里需要手动处理或使用邮件API）
    console.log(`⏳ 等待邮箱验证...`);
    await page.waitForTimeout(30000);

    // 检查是否成功
    const currentUrl = page.url();
    if (currentUrl.includes('/upload') || currentUrl.includes('/foryou')) {
      console.log(`✅ 注册成功: ${profile.username}`);

      // 保存账号信息
      const cookies = await context.cookies();
      await supabase.from('marketing_accounts').insert({
        username: profile.username,
        email: profile.email,
        password: profile.password,
        cookies: JSON.stringify(cookies),
        status: 'registered',
        profile_data: JSON.stringify(profile)
      });

      await browser.close();
      return true;
    } else {
      console.log(`⚠️ 需要邮箱验证: ${profile.username}`);
      // 保存待验证账号
      await supabase.from('marketing_accounts').insert({
        username: profile.username,
        email: profile.email,
        password: profile.password,
        status: 'pending_verification',
        profile_data: JSON.stringify(profile)
      });

      // 保存浏览器状态以便后续验证
      await browser.close();
      return 'needs_verification';
    }

  } catch (err) {
    console.log(`❌ 注册失败: ${profile.username} - ${err.message}`);
    await browser.close();
    return false;
  }
}

async function bulkRegister(count = 10) {
  console.log(`🚀 开始批量注册 ${count} 个账号...`);

  // 创建数据库表（如果不存在）
  await supabase.from('marketing_accounts').select('count').then(async ({ error }) => {
    if (error) {
      console.log('需要创建数据库表...');
      await createTable();
    }
  });

  const results = { success: 0, pending: 0, failed: 0 };

  for (let i = 0; i < count; i++) {
    const profile = {
      username: generateUsername(),
      email: generateEmail(generateUsername()),
      password: generatePassword(),
      created_at: new Date().toISOString()
    };

    console.log(`\n📊 进度: ${i + 1}/${count}`);
    
    const result = await registerAccount(profile);
    
    if (result === true) {
      results.success++;
    } else if (result === 'needs_verification') {
      results.pending++;
    } else {
      results.failed++;
    }

    // 随机间隔
    const delay = 5000 + Math.random() * 10000;
    console.log(`⏱ 等待 ${Math.round(delay/1000)} 秒...`);
    await new Promise(r => setTimeout(r, delay));
  }

  console.log(`\n📊 注册完成!`);
  console.log(`✅ 成功: ${results.success}`);
  console.log(`⏳ 待验证: ${results.pending}`);
  console.log(`❌ 失败: ${results.failed}`);
}

async function createTable() {
  // 这个需要在 Supabase SQL 中执行
  console.log(`
请在 Supabase SQL 中执行以下语句创建表:

create table marketing_accounts (
  id bigint generated always as identity primary key,
  username text,
  email text,
  password text,
  cookies text,
  status text default 'pending',
  profile_data jsonb,
  created_at timestamp default now()
);

alter table marketing_accounts enable row level security;
create policy "marketing_all" on marketing_accounts for all to anon using (true);
  `);
}

// 从命令行参数获取数量
const count = parseInt(process.argv[2]) || 5;
bulkRegister(count);

export { bulkRegister, registerAccount };
