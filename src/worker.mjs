import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createBrowser } from './browser.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function isPageAlive(page) {
  try {
    await page.evaluate(() => document.title);
    return true;
  } catch {
    return false;
  }
}

async function runWorker(accountDir) {
  console.log('🚀 真人行为模式:', accountDir);

  let { context, page } = await createBrowser(accountDir);
  let restartCount = 0;
  const MAX_RESTARTS = 3;

  try {
    await page.goto('https://www.tiktok.com/foryou', {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });

    await page.waitForTimeout(8000);

    console.log('⚠️ 如未登录，请手动登录');
    await page.waitForTimeout(15000);

    let count = 0;

    while (count < 50) {
      count++;
      
      if (!(await isPageAlive(page))) {
        console.log('⚠️ 页面已关闭，尝试重启...');
        restartCount++;
        if (restartCount > MAX_RESTARTS) {
          console.log('❌ 重启次数过多，退出');
          break;
        }
        await context.close().catch(() => {});
        const result = await createBrowser(accountDir);
        context = result.context;
        page = result.page;
        await page.goto('https://www.tiktok.com/foryou');
        await page.waitForTimeout(5000);
        continue;
      }

      console.log(`🎬 视频 #${count}`);

      const watchTime = 8000 + Math.random() * 15000;  // 更长观看时间
      console.log(`⏱ 观看 ${Math.round(watchTime/1000)} 秒`);
      await page.waitForTimeout(watchTime);

      if (Math.random() < 0.3) {
        try {
          await page.keyboard.press('KeyL');
          console.log('👍 点赞');
        } catch {}
      }

      if (Math.random() < 0.3) {  // 30% 概率点赞评论
        try {
          if (!(await isPageAlive(page))) continue;
          
          console.log('💬 浏览评论区点赞...');
          
          // 1. 点击评论按钮
          const commentBtn = page.locator('[data-e2e="comment-icon"]').first();
          if (await commentBtn.count() > 0) {
            await commentBtn.click({ force: true });
            console.log('✅ 打开评论区');
          }
          await page.waitForTimeout(2500);
          
          // 2. 滚动加载评论
          for (let i = 0; i < 5; i++) {
            await page.mouse.wheel(0, 400);
            await page.waitForTimeout(600);
          }
          await page.waitForTimeout(1000);
          
          // 3. 用 evaluate 查找并点击点赞按钮
          const result = await page.evaluate(() => {
            let clicked = 0;
            
            // 方法1: 查找包含心形 SVG 的按钮
            const heartSvgs = document.querySelectorAll('svg path[d*="M12 21.35"]');
            heartSvgs.forEach((svg, idx) => {
              if (clicked < 3) {
                const btn = svg.closest('button, div[role="button"]');
                if (btn && !btn.classList.contains('liked')) {
                  btn.click();
                  btn.classList.add('liked');
                  clicked++;
                }
              }
            });
            
            // 方法2: 备用 - 查找所有按钮
            if (clicked === 0) {
              const buttons = document.querySelectorAll('button');
              buttons.forEach(btn => {
                if (clicked < 2 && !btn.classList.contains('liked')) {
                  const svg = btn.querySelector('svg');
                  if (svg && svg.innerHTML.includes('12 21')) {
                    btn.click();
                    btn.classList.add('liked');
                    clicked++;
                  }
                }
              });
            }
            
            return clicked;
          });
          
          if (result > 0) {
            console.log(`❤️ 成功点赞 ${result} 条评论`);
            await supabase.from('comment_logs').insert({
              account: accountDir,
              video_url: page.url(),
              content: `liked_${result}_comments`,
              status: 'success'
            });
          } else {
            console.log('❌ 未找到可点赞的评论');
          }
          
          await page.waitForTimeout(1000);
          
        } catch (err) {
          console.log('⚠️ 评论点赞失败');
        }
      }

      if (await isPageAlive(page)) {
        // 更随机的滑动方式
        if (Math.random() < 0.5) {
          await page.keyboard.press('ArrowDown');
        } else {
          await page.mouse.wheel(0, 300);
        }
        await page.waitForTimeout(2000 + Math.random() * 2000);
      }
    }

  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await context.close().catch(() => {});
  }
}

runWorker('accounts/acc1');
