import { expect, test } from '@playwright/test';

test('Guardian uses separate login, sees linked issued notice, and remains read-only at desktop and mobile widths', async ({ page }) => {
  const loginId = process.env.GUARDIAN_TEST_LOGIN;
  const password = process.env.GUARDIAN_TEST_PASSWORD;
  const residentId = process.env.GUARDIAN_TEST_RESIDENT_ID;
  const otherResidentId = process.env.GUARDIAN_TEST_OTHER_RESIDENT_ID;
  if (!loginId || !password || !residentId || !otherResidentId) throw new Error('SYNTHETIC_GUARDIAN_BROWSER_FIXTURE_REQUIRED');
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Thân nhân' }).click();
  await page.getByLabel(/Tên đăng nhập thân nhân/).fill(loginId);
  await page.getByLabel(/Mật khẩu đăng nhập/).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập Cổng Thân Nhân' }).click();
  await expect(page.getByText(/Đăng nhập thành công/)).toBeVisible();

  await page.goto('/family-portal');
  await expect(page.getByRole('heading', { name: 'Thông báo thu tiền tháng' })).toBeVisible();
  await expect(page.getByText('Synthetic Guardian Resident')).toBeVisible();
  await expect(page.getByText('10.000 ₫', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('7.500 ₫', { exact: false })).toBeVisible();
  await expect(page.getByText('Bữa ăn của người cao tuổi đã bao gồm trong gói; không thu riêng.')).toBeVisible();
  await expect(page.getByText('Synthetic Unlinked Resident')).toHaveCount(0);

  await page.getByRole('button', { name: 'Đăng Ký Cơm Tâm An' }).click();
  await page.getByLabel(/Ngày đăng ký ăn/).fill('2026-10-22');
  await page.getByLabel(/Số lượng suất ăn/).fill('2');
  await page.getByRole('button', { name: '🍽️ Đăng Ký Bữa Ăn' }).click();
  await expect(page.getByText(/Đã ghi nhận đăng ký 2 suất/)).toBeVisible();
  await expect(page.getByText('Chờ xác nhận')).toBeVisible();
  await page.getByRole('button', { name: 'Thông Báo Thu Phí' }).click();
  await expect(page.getByText('10.000 ₫', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('7.500 ₫', { exact: false })).toBeVisible();

  const token = await page.evaluate(() => localStorage.getItem('taman-care-production-access-token'));
  expect(token).toBeTruthy();
  const crossResident = await page.request.get(`/api/family-portal/residents/${encodeURIComponent(otherResidentId)}`, {
    headers: { Authorization: `Bearer ${token}`, 'x-actor-id': 'forged-supervisor', 'x-actor-role': 'SUPERVISOR' },
  });
  expect(crossResident.status()).toBe(403);
  const paymentMutation = await page.request.post('/api/finance-write/invoices/issue', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(paymentMutation.status()).toBe(403);

  await page.setViewportSize({ width: 390, height: 844 });
  const noticeTable = page.locator('.data-table').first();
  await expect(noticeTable).toBeVisible();
  const scrollable = await noticeTable.evaluate(element => {
    const parent = element.parentElement;
    return Boolean(parent && parent.scrollWidth > parent.clientWidth);
  });
  expect(scrollable).toBe(true);
  expect(pageErrors).toEqual([]);
});
