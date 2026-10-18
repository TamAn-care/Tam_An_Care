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
  // The current login labels are not associated with their inputs in the
  // shared RBAC worktree. Use the visible placeholders without changing that
  // agent-owned auth UI from the Finance branch.
  await page.getByPlaceholder(/Nhập Mã nhân viên/).fill(user.id);
  await page.getByPlaceholder('Nhập mật khẩu...').fill(user.password);
  const loginResponse = page.waitForResponse(response =>
    response.url().includes('/api/auth/login') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Đăng Nhập Hệ Thống/ }).click();
  const response = await loginResponse;
  if (!response.ok()) {
    const route = new URL(response.url()).pathname;
    throw new Error(`Synthetic Finance E2E login failed at ${route} with HTTP ${response.status()}`);
  }
  await expect(page.getByText('Đăng nhập tài khoản để thực thi nhiệm vụ đúng thẩm quyền')).toHaveCount(0);
  await page.goto('/billing-invoicing');
  await page.getByRole('button', { name: /Bảng Giá Dịch Vụ/ }).click();
  await expect(page.getByRole('region', { name: 'Bảng giá dịch vụ chính thức' })).toBeVisible();
}

async function closeSession(page: Page) {
  const logout = page.getByRole('button', { name: /Đăng xuất/i });
  if (await logout.count()) await logout.first().click({ timeout: 3_000 }).catch(() => undefined);
}

async function withActorPage<T>(browser: Browser, user: Account, run: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext({ baseURL: process.env.FINANCE_E2E_BASE_URL, viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  try {
    await login(page, user);
    return await run(page);
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
    const pricing = page.getByRole('region', { name: 'Bảng giá dịch vụ chính thức' });
    await pricing.getByLabel('Mã bảng giá').fill(code);
    await pricing.getByLabel('Tên phiên bản').fill(`Synthetic E2E ${stamp}`);
    await pricing.getByLabel('Hiệu lực từ').fill(effectiveFrom);
    await pricing.getByLabel('Mã dịch vụ').fill(serviceCode);
    await pricing.getByLabel('Tên dịch vụ').fill('Synthetic service test');
    await pricing.getByLabel('Đơn giá VND').fill('123456');
    await pricing.getByRole('button', { name: 'Tạo bản nháp' }).click();
    await expect(page.getByText('Đã lưu bản nháp trên máy chủ.')).toBeVisible();
    const row = pricing.getByRole('row').filter({ hasText: code });
    await expect(row).toContainText('Bản nháp');
    await row.getByRole('button', { name: 'Sửa nháp' }).click();
    await pricing.getByRole('heading', { name: /Chỉnh sửa bản nháp/ }).locator('..').getByLabel('Đơn giá VND').fill('123457');
    await pricing.getByRole('button', { name: 'Lưu nháp' }).click();
    await expect(page.getByText('Đã cập nhật bản nháp.')).toBeVisible();
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
    const pricing = page.getByRole('region', { name: 'Bảng giá dịch vụ chính thức' });
    const row = pricing.getByRole('row').filter({ hasText: code });
    await expect(row).toContainText('Bản nháp');
    await row.getByRole('button', { name: 'Trình duyệt' }).click();
    await expect(page.getByText('Thao tác đã được máy chủ xác nhận.')).toBeVisible();
    await expect(pricing.getByRole('row').filter({ hasText: code })).toContainText('Chờ phê duyệt');
  });

  await withActorPage(browser, approverUser, async page => {
    const pricing = page.getByRole('region', { name: 'Bảng giá dịch vụ chính thức' });
    const row = pricing.getByRole('row').filter({ hasText: code });
    await pricing.getByLabel('Lý do phê duyệt/từ chối').fill('Approved synthetic Finance E2E evidence');
    await row.getByRole('button', { name: 'Phê duyệt' }).click();
    await expect(page.getByText('Thao tác đã được máy chủ xác nhận.')).toBeVisible();
    await expect(pricing.getByRole('row').filter({ hasText: code })).toContainText('Đã phê duyệt');
  });

  await withActorPage(browser, accountantUser, async page => {
    const pricing = page.getByRole('region', { name: 'Bảng giá dịch vụ chính thức' });
    const row = pricing.getByRole('row').filter({ hasText: code });
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

  const mobileContext = await browser.newContext({ baseURL: process.env.FINANCE_E2E_BASE_URL, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const mobile = await mobileContext.newPage();
  try {
    await login(mobile, accountantUser);
    const table = mobile.getByRole('region', { name: 'Bảng giá dịch vụ chính thức' }).getByRole('table');
    await expect(table).toBeVisible();
    const horizontalOverflow = await table.evaluate(node => node.parentElement!.scrollWidth > node.parentElement!.clientWidth);
    expect(horizontalOverflow).toBe(true);
  } finally {
    await closeSession(mobile);
    await mobileContext.close();
  }
});
