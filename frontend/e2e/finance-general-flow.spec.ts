import { test, expect, type Page } from '@playwright/test';

const password = process.env.FINANCE_E2E_PASSWORD || 'synthetic-v428-password-only';
const users = {
  accountant: { id: 'CI_ACCOUNTANT', password },
  reviewer: { id: 'CI_SUBMITTER', password },
  admin: { id: 'CI_APPROVER', password },
};

async function login(page: Page, user: { id: string; password: string }) {
  await page.goto('/');
  await page.getByPlaceholder(/Nhập Mã nhân viên/).fill(user.id);
  await page.getByPlaceholder('Nhập mật khẩu...').fill(user.password);
  await page.getByRole('button', { name: /Đăng Nhập Hệ Thống/ }).click();
  await expect(page.getByText('Đăng nhập tài khoản để thực thi nhiệm vụ đúng thẩm quyền')).toHaveCount(0);
  await page.goto('/billing-invoicing');
  await page.getByRole('button', { name: /Finance Tổng Hợp/ }).click();
  await expect(page.getByRole('region', { name: 'Finance tổng hợp' })).toBeVisible();
}

async function logout(page: Page) {
  const button = page.getByRole('button', { name: /Đăng xuất/i });
  if (await button.count()) await button.first().click().catch(() => undefined);
}

test('general Finance browser workflow preserves server-side RBAC', async ({ browser }) => {
  test.skip(!process.env.FINANCE_E2E_BASE_URL, 'Requires disposable candidate runtime');
  const stamp = Date.now();
  let invoiceId = '';
  const accountantContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const accountant = await accountantContext.newPage();
  await login(accountant, users.accountant);
  const panel = accountant.getByRole('region', { name: 'Finance tổng hợp' });
  await panel.getByLabel('Mã hợp đồng Finance').fill('CONTRACT_V428');
  await panel.getByLabel('Mã người cao tuổi Finance').fill('RES_V428');
  await expect(panel.getByLabel('Kỳ lập hóa đơn Finance')).toHaveValue('2026-07');
  await panel.getByRole('button', { name: 'Lập hóa đơn nháp' }).click();
  await expect(panel.getByText(/Đã thực hiện/)).toBeVisible();
  invoiceId = await panel.getByLabel('Mã hóa đơn Finance').inputValue();
  expect(invoiceId).toMatch(/^INV_/);
  await logout(accountant); await accountantContext.close();

  const reviewerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const reviewer = await reviewerContext.newPage();
  await login(reviewer, users.reviewer);
  const reviewPanel = reviewer.getByRole('region', { name: 'Finance tổng hợp' });
  await reviewPanel.getByLabel('Mã hóa đơn Finance').fill(invoiceId);
  await reviewPanel.getByRole('button', { name: 'Kiểm tra hóa đơn' }).click();
  await expect(reviewPanel.getByText(/Đã thực hiện/)).toBeVisible();
  await logout(reviewer); await reviewerContext.close();

  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const admin = await adminContext.newPage();
  await login(admin, users.admin);
  const adminPanel = admin.getByRole('region', { name: 'Finance tổng hợp' });
  await adminPanel.getByLabel('Mã hóa đơn Finance').fill(invoiceId);
  await adminPanel.getByRole('button', { name: 'Phê duyệt hóa đơn' }).click();
  await adminPanel.getByRole('button', { name: 'Phát hành hóa đơn' }).click();
  await expect(adminPanel.getByText(/Đã thực hiện/)).toBeVisible();
  await logout(admin); await adminContext.close();

  const accountant2Context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const accountant2 = await accountant2Context.newPage();
  await login(accountant2, users.accountant);
  const mobilePanel = accountant2.getByRole('region', { name: 'Finance tổng hợp' });
  await mobilePanel.getByLabel('Mã hóa đơn Finance').fill(invoiceId);
  await mobilePanel.getByLabel('Mã phiếu thu Finance').fill(`REC_${stamp}`);
  await mobilePanel.getByLabel('Số tiền phiếu thu Finance').fill('12000000');
  await mobilePanel.getByRole('button', { name: 'Tạo phiếu thu' }).click();
  await expect(mobilePanel.getByText(/Đã thực hiện/)).toBeVisible();
  await expect(mobilePanel.getByText('Chưa đủ dữ liệu để xác nhận')).toBeVisible();
  await logout(accountant2); await accountant2Context.close();

  const financeAdminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const financeAdmin = await financeAdminContext.newPage();
  await login(financeAdmin, users.admin);
  const financePanel = financeAdmin.getByRole('region', { name: 'Finance tổng hợp' });
  await financePanel.getByLabel('Mã hóa đơn Finance').fill(invoiceId);
  await financePanel.getByLabel('Mã phiếu thu Finance').fill(`REC_${stamp}`);
  await financePanel.getByRole('button', { name: 'Xác minh phiếu thu' }).click();
  await expect(financePanel.getByText(/Đã thực hiện/)).toBeVisible();
  await financePanel.getByLabel('Mã hóa đơn Finance').fill(invoiceId);
  await financePanel.getByLabel('Mã phiếu thu Finance').fill(`REC_${stamp}`);
  await financePanel.getByLabel('Số tiền phân bổ Finance').fill('12000000');
  const allocationResponse = financeAdmin.waitForResponse(response => response.url().includes('/api/finance-write/allocations') && response.request().method() === 'POST');
  await financePanel.getByRole('button', { name: 'Phân bổ khoản thu' }).click();
  expect((await allocationResponse).status()).toBeLessThan(300);
  await financePanel.getByLabel('Mã hóa đơn Finance').fill(invoiceId);
  const ledgerResponse = financeAdmin.waitForResponse(response => response.url().includes('/post-ledger') && response.request().method() === 'POST');
  await financePanel.getByRole('button', { name: 'Ghi nhận sổ cái' }).click();
  expect((await ledgerResponse).status()).toBeLessThan(300);
  const closeResponse = financeAdmin.waitForResponse(response => response.url().includes('/periods/2026-07/close') && response.request().method() === 'POST');
  await financePanel.getByRole('button', { name: 'Khóa kỳ' }).click();
  expect((await closeResponse).status()).toBeLessThan(300);
  const reopenResponse = financeAdmin.waitForResponse(response => response.url().includes('/periods/2026-07/reopen') && response.request().method() === 'POST');
  await financePanel.getByRole('button', { name: 'Mở lại kỳ' }).click();
  expect((await reopenResponse).status()).toBeLessThan(300);
  await logout(financeAdmin); await financeAdminContext.close();
});
