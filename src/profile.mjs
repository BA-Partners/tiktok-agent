export async function updateBio(page, bioText) {
  console.log('🧾 进入主页');

  await page.goto('https://www.tiktok.com/@me', {
    waitUntil: 'domcontentloaded'
  });

  await page.waitForTimeout(5000);

  console.log('👉 查找编辑按钮');

  // ✅ 多重匹配（兼容新版UI）
  const editBtn = page.locator('button:has-text("Edit"), button:has-text("编辑")').first();

  await editBtn.waitFor({ timeout: 15000 });
  await editBtn.click();

  await page.waitForTimeout(3000);

  console.log('👉 查找 Bio 输入框');

  // ✅ 更稳：找 textarea 或 contenteditable
  const bioInput = page.locator('textarea, [contenteditable="true"]').first();

  await bioInput.waitFor({ timeout: 10000 });

  // 清空再填
  await bioInput.fill('');
  await page.waitForTimeout(500);
  await bioInput.type(bioText, { delay: 50 });

  await page.waitForTimeout(1000);

  console.log('👉 查找保存按钮');

  const saveBtn = page.locator('button:has-text("Save"), button:has-text("保存")').first();

  await saveBtn.waitFor({ timeout: 10000 });
  await saveBtn.click();

  console.log('✅ Bio 已更新');

  await page.waitForTimeout(5000);
}
