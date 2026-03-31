export async function runSniper(page, LINK) {
  console.log('🎯 启动截流');

  const keywords = ['ai赚钱', 'make money online', 'side hustle'];
  const keyword = keywords[Math.floor(Math.random() * keywords.length)];

  console.log('🔍 搜索:', keyword);

  await page.goto(`https://www.tiktok.com/search?q=${encodeURIComponent(keyword)}`, {
    waitUntil: 'domcontentloaded'
  });

  await page.waitForTimeout(8000);

  const videos = page.locator('a[href*="/video/"]');
  const count = await videos.count();

  console.log('📊 找到视频数量:', count);

  const limit = Math.min(count, 5); // 🔥 可以适当提高

  const usedIndexes = new Set();

  for (let i = 0; i < limit; i++) {
    try {
      let target = null;
      let index = -1;

      // =========================
      // 🎯 找一个“没用过”的视频
      // =========================
      for (let t = 0; t < 15; t++) {
        const rand = Math.floor(Math.random() * count);

        if (usedIndexes.has(rand)) continue;

        const v = videos.nth(rand);

        if (await v.isVisible()) {
          target = v;
          index = rand;
          usedIndexes.add(rand);
          break;
        }
      }

      if (!target) {
        console.log('⚠️ 没找到新视频，跳过');
        continue;
      }

      // =========================
      // ▶️ 打开视频
      // =========================
      await target.scrollIntoViewIfNeeded();
      await page.waitForTimeout(2000);
      await target.click();

      await page.waitForTimeout(5000);

      // =========================
      // 💬 评论内容（随机 + 带链接）
      // =========================
      const prefixes = [
        '🔥 this works',
        '💡 try this',
        '🚀 don’t miss',
        '👀 check this',
        '📈 insane method'
      ];

      const actions = [
        'full guide',
        'learn here',
        'get it here',
        'see details',
        'start here'
      ];

      const suffix = [
        '👇',
        '👉',
        '',
        '💬',
        '📌'
      ];

      const comment = `${
        prefixes[Math.floor(Math.random() * prefixes.length)]
      } ${suffix[Math.floor(Math.random() * suffix.length)]} ${
        actions[Math.floor(Math.random() * actions.length)]
      } ${LINK}`;

      // =========================
      // ✍️ 输入评论
      // =========================
      const input = page.locator('[contenteditable="true"]').last();

      await input.waitFor({ timeout: 15000 });
      await input.click();

      await page.keyboard.type(comment, { delay: 50 });
      await page.keyboard.press('Enter');

      console.log(`💬 已评论视频 index=${index}`);

      // =========================
      // ⏱ 等待 60 秒（核心）
      // =========================
      console.log('⏱ 等待 60 秒...');
      await page.waitForTimeout(60000);

      // =========================
      // ❌ 关闭视频（返回列表）
      // =========================
      await page.keyboard.press('Escape');
      await page.waitForTimeout(5000);

    } catch (e) {
      console.log('⚠️ 跳过一个视频');
    }
  }

  console.log('✅ 截流完成');
}
