import 'dotenv/config';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import EmailService from './email.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const emailService = new EmailService(process.env.EMAIL_PROVIDER || 'tempmail');

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
  const context = await chromium.launchPersistentContext(
    `./accounts/${profile.username}`,
    { 
      headless: false,
      args: ['--disable-blink-features=AutomationControlled']
    }
  );
  
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });

  // 创建临时邮箱
  let inbox = null;
  try {
    inbox = await emailService.createInbox();
    profile.email = inbox.email;
    console.log(`📧 临时邮箱: ${inbox.email}`);
  } catch (err) {
    console.log(`⚠️ 邮箱服务创建失败，使用备用邮箱`);
    profile.email = generateEmail(generateUsername());
  }

  try {
    console.log(`📝 开始注册: ${profile.username}`);
    
    // 访问注册页面
    await page.goto('https://www.tiktok.com/signup', { 
      waitUntil: 'domcontentloaded',
      timeout: 120000 
    });
    await page.waitForTimeout(3000);

    console.log(`🔍 当前页面: ${await page.url()}`);

    // 点击邮箱注册选项
    const signupMethods = [
      'text=Sign up with phone or email',
      'text=Use phone / email / username',
      'text=Email',
    ];

    for (const method of signupMethods) {
      try {
        const btn = page.locator(method).first();
        if (await btn.count() > 0) {
          await btn.click({ timeout: 3000 });
          console.log(`✅ 点击: ${method}`);
          await page.waitForTimeout(2000);
          break;
        }
      } catch {}
    }

    // 输入邮箱
    const emailSelectors = [
      'input[type="email"]',
      'input[placeholder*="email" i]',
      'input:not([type])'
    ];

    for (const sel of emailSelectors) {
      const input = page.locator(sel).first();
      if (await input.count() > 0) {
        try {
          await input.click({ timeout: 2000 });
          await input.fill(profile.email);
          console.log(`✅ 输入邮箱: ${profile.email}`);
          break;
        } catch {}
      }
    }

    // 点击继续
    await page.waitForTimeout(1000);
    const continueBtn = page.locator('button:has-text("Continue"), button:has-text("下一步")').first();
    if (await continueBtn.count() > 0) {
      await continueBtn.click({ timeout: 3000 });
      console.log(`✅ 点击继续`);
      await page.waitForTimeout(2000);
    }

    // 输入用户名
    const usernameSelectors = ['input[placeholder*="username" i]', 'input[placeholder*="Username" i]'];
    for (const sel of usernameSelectors) {
      const input = page.locator(sel).first();
      if (await input.count() > 0) {
        await input.fill(profile.username);
        console.log(`✅ 输入用户名`);
        await page.waitForTimeout(1500);
        break;
      }
    }

    // 输入密码
    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.count() > 0) {
      await passwordInput.fill(profile.password);
      console.log(`✅ 输入密码`);
    }

    // 点击注册
    const signupBtn = page.locator('button:has-text("Sign up"), button:has-text("注册")').first();
    if (await signupBtn.count() > 0) {
      await signupBtn.click();
      console.log(`✅ 点击注册`);
      await page.waitForTimeout(3000);
    }

    // 自动验证邮箱
    if (inbox) {
      console.log(`⏳ 等待验证码邮件...`);
      
      let verificationCode = null;
      let attempts = 0;
      const maxAttempts = 20;

      while (!verificationCode && attempts < maxAttempts) {
        await page.waitForTimeout(5000);
        attempts++;
        
        const emails = await emailService.checkInbox(inbox);
        console.log(`📬 检查邮箱... (${attempts}/${maxAttempts}), 收到 ${emails.length} 封邮件`);
        
        if (emails.length > 0) {
          const result = emailService.extractVerificationCode(emails);
          if (result) {
            verificationCode = result.code;
            console.log(`✅ 找到验证码: ${verificationCode}`);
          }
        }
      }

      if (verificationCode) {
        // 查找验证码输入框
        const codeInput = page.locator('input[placeholder*="code" i], input[placeholder*="Code" i], input[maxlength="6"]').first();
        if (await codeInput.count() > 0) {
          await codeInput.fill(verificationCode);
          console.log(`✅ 输入验证码`);
          
          // 点击确认
          const verifyBtn = page.locator('button:has-text("Verify"), button:has-text("确认"), button:has-text("Submit")').first();
          if (await verifyBtn.count() > 0) {
            await verifyBtn.click();
            console.log(`✅ 点击确认`);
            await page.waitForTimeout(5000);
          }
        }
      } else {
        console.log(`⚠️ 未收到验证码`);
      }
    }

    // 检查是否成功
    const currentUrl = page.url();
    if (currentUrl.includes('/upload') || currentUrl.includes('/foryou') || currentUrl.includes('/discover') || currentUrl.includes('/settings')) {
      console.log(`✅ 注册成功: ${profile.username}`);
      const cookies = await context.cookies();
      await supabase.from('marketing_accounts').insert({
        username: profile.username,
        email: profile.email,
        password: profile.password,
        cookies: JSON.stringify(cookies),
        status: 'registered',
        profile_data: JSON.stringify(profile)
      });
      await context.close();
      return true;
    } else {
      console.log(`⏳ 需要额外验证: ${profile.username}`);
      await supabase.from('marketing_accounts').insert({
        username: profile.username,
        email: profile.email,
        password: profile.password,
        status: 'pending_verification',
        profile_data: JSON.stringify(profile)
      });
      await context.close();
      return 'needs_verification';
    }

  } catch (err) {
    console.log(`❌ 注册失败: ${profile.username} - ${err.message}`);
    await context.close().catch(() => {});
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
