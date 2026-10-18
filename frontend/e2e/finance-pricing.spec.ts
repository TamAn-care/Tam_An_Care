import { test, expect, type Browser, type Page } from '@playwright/test';

type Account = { id: string; password: string };
const account = (idKey: string, passwordKey: string): Account => {
  const id = process.env[idKey];
  const password = process.env[passwordKey];
  if (!id || !password) throw new Error(`Missing synthetic Finance E2E credentials: ${idKey}/${passwordKey}`);
  return { id, password };
};

const maker = () => account('FINANCE_E2E_MAKER_ID', 'FINANCE_E2E_MAKER_PASSWORD');
const submitter = () => account('FINANCE_E2E_SUBMITTER_ID', 'FINANCE_E2E_SUBMITTER_PASSWORD');
const approver = () => account('FINANCE_E2E_APPROVER_ID', 'FINANCE_E2E_APPROVER_PASSWORD');
const accountant = () => account('FINANCE_E2E_ACCOUNTANT_ID', 'FINANCE_E2E_ACCOUNTANT_PASSWORD');

async function login(page: Page, user: Account) {
  await page.goto('/');
  await page.getByLabel('Tên đăng nhập / Mã nhân viên').fill(user.id);
  await page.getByLabel('Mật khẩu đăng nhập').fill(user.password);
  await page.getByRole('button', { name: /Đăng Nhập Hệ Thống/ }).click();
  await expect(page.getByText('Đăng nhập tài khoản để thực thi nhiệm vụ đúng thẩm quyền')).toHaveCount(0);
  await page.goto('/billing-invoicing');
  await page.getByRole('button', { name: 'Mở bảng giá dịch vụ' }).click();
  await expect(page.getByRole('heading', { name: 'Bảng giá dịch vụ chính thức' })).toBeVisible();
}

async function closeSession(page: Page) {
  const logout = page.getByRole('button', { name: /Đăng xuất/i });
  if (await logout.count()) await logout.first().click({ timeout: 3_000 }).catch(() => undefined);
}

async function withActorPage<T>(browser: Browser, user: Account, run: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext({ baseURL: process.env.FINANCE_E2E_BASE_URL, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  let tracing = false;
  try {
    await login(page, user);
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    tracing = true;
    try {
      return await run(page);
    } catch (error) {
      await context.tracing.stop({ path: test.info().outputPath(`${test.info().project.name}-failure.zip`) });
      tracing = false;
      throw error;
    } finally {
      if (tracing) await context.tracing.stop().catch(() => undefined);
    }
  } finally {
    await closeSession(page);
    await context.close();
  }
}

test('pricing lifecycle uses separate synthetic maker, submitter and approver; accountant is denied', async ({ browser }, testInfo) => {
  test.skip(!process.env.FINANCE_E2E_BASE_URL, 'Set FINANCE_E2E_BASE_URL to a disposable isolated app with synthetic test accounts.');
  const makerUser = maker();
  const submitterUser = submitter();
  const approverUser = approver();
  const accountantUser = accountant();
  const stamp = `${Date.now()}_${testInfo.project.name.replace(/[^a-z0-9]/gi, '')}`;
  const code = `E2E_${stamp}`;
  const serviceCode = `E2E_SERVICE_${stamp}`;
  const effectiveFrom = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  let priceListId = '';
  let version = 1;

  await withActorPage(browser, makerUser, async page => {
    await page.getByLabel('Mã bảng giá').fill(code);
    await page.getByLabel('Tên phiên bản').fill(`Synthetic E2E ${stamp}`);
    await page.getByLabel('Hiệu lực từ').fill(effectiveFrom);
    await page.getByLabel('Mã dịch vụ').fill(serviceCode);
    await page.getByLabel('Tên dịch vụ').fill('Synthetic service test');
    await page.getByLabel('Đơn giá VND').fill('123456');
    await page.getByRole('button', { name: 'Tạo bản nháp' }).click();
    await expect(page.getByRole('status')).toContainText('Đã lưu bản nháp trên máy chủ');
    const row = page.getByRole('row').filter({ hasText: code });
    await expect(row).toContainText('Bản nháp');
    await row.getByRole('button', { name: 'Sửa nháp' }).click();
    await page.getByRole('heading', { name: /Chỉnh sửa bản nháp/ }).locator('..').getByLabel('Đơn giá VND').fill('123457');
    await page.getByRole('button', { name: 'Lưu nháp' }).click();
    await expect(page.getByRole('status')).toContainText('Đã cập nhật bản nháp');
    const catalog = await page.evaluate(async () => {
      const response = await fetch('/api/finance/service-prices');
      if (!response.ok) throw new Error(`catalog read ${response.status}`);
      return response.json();
    }) as Array<{ priceListId: string; version: number; code: string }>;
    const created = catalog.find(item => item.code === code);
    expect(created).toBeTruthy();
    priceListId = created!.priceListId;
    version = created!.version;
  });

  await withActorPage(browser, submitterUser, async page => {
    const row = page.getByRole('row').filter({ hasText: code });
    await expect(row).toContainText('Bản nháp');
    await row.getByRole('button', { name: 'Trình duyệt' }).click();
    await expect(page.getByRole('status')).toContainText('Thao tác đã được máy chủ xác nhận');
    await expect(page.getByRole('row').filter({ hasText: code })).toContainText('Chờ phê duyệt');
  });

  await withActorPage(browser, approverUser, async page => {
    const row = page.getByRole('row').filter({ hasText: code });
    await page.getByLabel('Lý do phê duyệt/từ chối').fill('Approved synthetic Finance E2E evidence');
    await row.getByRole('button', { name: 'Phê duyệt' }).click();
    await expect(page.getByRole('status')).toContainText('Thao tác đã được máy chủ xác nhận');
    await expect(page.getByRole('row').filter({ hasText: code })).toContainText('Đã phê duyệt');
  });

  await withActorPage(browser, accountantUser, async page => {
    const row = page.getByRole('row').filter({ hasText: code });
    await expect(row).toContainText('Đã phê duyệt');
    await expect(row.getByRole('button', { name: /Phê duyệt|Từ chối|Sao chép thành bản mới/ })).toHaveCount(0);
    const deniedStatus = await page.evaluate(async ({ priceListId, version }) => {
      const response = await fetch(`/api/finance/service-prices/${priceListId}/versions/${version}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Synthetic forbidden approval attempt' }),
      });
      return response.status;
    }, { priceListId, version });
    expect(deniedStatus).toBe(403);
  });

  const mobileContext = await browser.newContext({ baseURL: process.env.FINANCE_E2E_BASE_URL, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mobile = await mobileContext.newPage();
  try {
    await login(mobile, accountantUser);
    await mobileContext.tracing.start({ screenshots: true, snapshots: true, sources: false });
    try {
    const table = mobile.getByRole('table');
    await expect(table).toBeVisible();
    const horizontalOverflow = await table.evaluate(node => node.parentElement!.scrollWidth > node.parentElement!.clientWidth);
    expect(horizontalOverflow).toBe(true);
    } catch (error) {
      await mobileContext.tracing.stop({ path: test.info().outputPath(`${test.info().project.name}-mobile-failure.zip`) });
      throw error;
    } finally {
      await mobileContext.tracing.stop().catch(() => undefined);
    }
  } finally {
    await closeSession(mobile);
    await mobileContext.close();
  }
});
