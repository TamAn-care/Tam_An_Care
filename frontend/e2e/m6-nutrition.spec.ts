import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';

const secret = 'm6-isolated-http-secret-012345678901234567890';
const actors = {
  nutrition: { actorId: 'nutrition-one', actorRole: 'NUTRITIONIST', displayName: 'Synthetic Nutrition', session: '33333333-3333-4333-8333-333333333333' },
  caregiver: { actorId: 'cg-one', actorRole: 'CAREGIVER', displayName: 'Synthetic Caregiver', session: '44444444-4444-4444-8444-444444444444' },
  manager: { actorId: 'manager-one', actorRole: 'CARE_MANAGER', displayName: 'Synthetic Manager', session: '55555555-5555-4555-8555-555555555555' },
};

function token(actor: typeof actors.nutrition) {
  const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const h = enc({ alg: 'HS256', typ: 'JWT' });
  const p = enc({ sub: actor.actorId, role: actor.actorRole, jti: actor.session, exp: Math.floor(Date.now() / 1000) + 3600 });
  const s = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

async function assume(page: any, actor: typeof actors.nutrition) {
  await page.goto('/');
  await page.evaluate(({ value, jwt }) => {
    localStorage.setItem('taman-care-production-access-token', jwt);
    localStorage.setItem('taman-care-v75-development-actor', JSON.stringify(value));
  }, { value: actor, jwt: token(actor) });
  await page.goto('/kitchen-operations');
  await expect(page.getByText('Nghiệp vụ dinh dưỡng bền vững')).toBeVisible();
}

test('Nutrition roles use real API and persist across reload', async ({ page, request }) => {
  await assume(page, actors.nutrition);
  await page.getByLabel('Resident ID').fill('resident-a');
  await page.getByLabel('Meal registration ID').fill('22222222-2222-4222-8222-222222222222');
  await page.getByLabel('Destination floor').fill('2');
  await page.getByLabel('Portions').fill('3');
  await page.getByRole('button', { name: 'Ghi nhận xuất khay' }).click();
  await expect(page.getByRole('status')).toContainText('Đã ghi nhận bền vững');
  await page.getByRole('button', { name: 'Tự xác nhận vệ sinh' }).click();
  await expect(page.getByRole('status')).toContainText('Đã ghi nhận bền vững');
  await page.reload();
  await expect(page.getByText('Nghiệp vụ dinh dưỡng bền vững')).toBeVisible();

  const list = await request.get('http://127.0.0.1:33123/api/nutrition-operations/tray-dispatches?date=2026-10-27', { headers: { authorization: `Bearer ${token(actors.nutrition)}` } });
  expect(list.ok()).toBeTruthy();
  const dispatches = await list.json();
  expect(dispatches.items.length).toBeGreaterThan(0);
});

test('Caregiver and manager controls are role-scoped on mobile/tablet', async ({ page }) => {
  await assume(page, actors.caregiver);
  await expect(page.getByRole('button', { name: 'Xác nhận nhận khay' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ghi nhận xuất khay' })).toHaveCount(0);
  await assume(page, actors.manager);
  await expect(page.getByRole('button', { name: 'Kiểm tra vệ sinh' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xác nhận nhận khay' })).toHaveCount(0);
});
