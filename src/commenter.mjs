export async function postComment(page, text) {
  console.log('💬 开始评论');

  // 等视频页面加载
  await page.waitForTimeout(5000);

  // 点击评论输入框
  const input = page.locator('[contenteditable="true"]').last();

  await input.waitFor({ timeout: 15000 });
  await input.click();

  // 输入评论
  await input.fill(text);

  await page.waitForTimeout(1000);

  // 回车发送
  await page.keyboard.press('Enter');

  console.log('✅ 评论已发送');

  await page.waitForTimeout(3000);
}

