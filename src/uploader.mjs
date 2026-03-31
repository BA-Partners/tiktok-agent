export async function uploadVideo(page, videoPath, caption) {
  console.log('👉 打开上传页');

  await page.goto('https://www.tiktok.com/upload', {
    timeout: 120000,
    waitUntil: 'domcontentloaded' // ✅ 改这里（避免卡死）
  });

  await page.waitForTimeout(5000);

  console.log('👉 查找 input[type=file]');
  const fileInput = await page.$('input[type="file"]');

  if (!fileInput) {
    throw new Error('找不到文件上传 input');
  }

  console.log('👉 上传视频:', videoPath);
  await fileInput.setInputFiles(videoPath);

  // ✅ 等视频处理（很关键）
  await page.waitForTimeout(15000);

  console.log('👉 填写文案');
  const editor = await page.locator('[contenteditable="true"]').first();
  await editor.click();
  await editor.fill(caption);

  await page.waitForTimeout(3000);

  console.log('👉 查找发布按钮');
  const publishBtn = page.locator('button:has-text("Post"), button:has-text("发布")');

  await publishBtn.waitFor({ timeout: 60000 });

  // ✅ 降低风控（模拟人类等待）
  await page.waitForTimeout(8000);

  console.log('👉 点击发布');
  await publishBtn.click();

  console.log('✅ 已点击发布');

  // ✅ 🔥 处理二次确认弹窗（核心）
  try {
    const confirmBtn = page.locator('text=立即发布');

    await confirmBtn.waitFor({ timeout: 5000 });

    console.log('⚠️ 检测到二次确认弹窗');

    await confirmBtn.click();

    console.log('✅ 已确认发布');

  } catch (e) {
    console.log('ℹ️ 没有出现二次确认');
  }

  // ✅ 等待发布完成（避免脚本太快结束）
  await page.waitForTimeout(10000);
}
