const { chromium } = require('playwright');
const crypto = require('node:crypto');

const BASE = process.env.M6_FRONTEND_URL || 'http://127.0.0.1:33124';
const API = process.env.M6_API_URL || 'http://127.0.0.1:33123';
const secret = 'm6-isolated-http-secret-012345678901234567890';
const actors = {
  nutrition: { actorId: 'nutrition-one', actorRole: 'NUTRITIONIST', displayName: 'Synthetic Nutrition', session: '33333333-3333-4333-8333-333333333333' },
  caregiver: { actorId: 'cg-one', actorRole: 'CAREGIVER', displayName: 'Synthetic Caregiver', session: '44444444-4444-4444-8444-444444444444' },
  manager: { actorId: 'manager-one', actorRole: 'CARE_MANAGER', displayName: 'Synthetic Manager', session: '55555555-5555-4555-8555-555555555555' },
  board: { actorId: 'board-one', actorRole: 'SUPERVISOR', displayName: 'Synthetic Board Readonly', session: '66666666-6666-4666-8666-666666666666' },
};
const registrationId = '22222222-2222-4222-8222-222222222222';

function token(actor) {
  const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const h = enc({ alg: 'HS256', typ: 'JWT' });
  const p = enc({ sub: actor.actorId, role: actor.actorRole, jti: actor.session, exp: Math.floor(Date.now() / 1000) + 3600 });
  const s = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

async function assume(page, actor) {
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(1000);
  await page.evaluate(({ actor, jwt }) => {
    localStorage.setItem('taman-care-production-access-token', jwt);
    localStorage.setItem('taman-care-v75-development-actor', JSON.stringify(actor));
  }, { actor, jwt: token(actor) });
  await page.reload();
  await page.goto(`${BASE}/kitchen-operations`);
  await page.getByText('Nghiệp vụ dinh dưỡng bền vững').waitFor({ state: 'visible', timeout: 10000 });
}

async function api(context, path, actor, options = {}) {
  return context.request.fetch(`${API}${path}`, { ...options, headers: { authorization: `Bearer ${token(actor)}`, ...(options.headers || {}) } });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    ['desktop', { width: 1440, height: 1000 }],
    ['mobile', { width: 390, height: 844 }],
    ['tablet', { width: 768, height: 1024 }],
  ];
  let dispatchId;
  let hygieneId;
  let sampleId;
  try {
    for (const [name, viewport] of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await assume(page, actors.nutrition);
      if (name === 'desktop') {
        await page.getByLabel('Resident ID').fill('resident-a');
        await page.getByLabel('Meal registration ID').fill(registrationId);
        await page.getByLabel('Destination floor').fill('2');
        await page.getByLabel('Portions').fill('3');
        await page.getByRole('button', { name: 'Ghi nhận xuất khay' }).click();
        await page.getByRole('status').filter({ hasText: 'Đã ghi nhận bền vững' }).waitFor({ state: 'visible' });
        const list = await api(context, `/api/nutrition-operations/tray-dispatches?date=${new Date().toISOString().slice(0, 10)}`, actors.nutrition);
        const body = await list.json(); dispatchId = body.items[0].dispatch_id;
        await page.getByRole('button', { name: 'Tự xác nhận vệ sinh' }).click();
        await page.getByRole('status').filter({ hasText: 'Đã ghi nhận bền vững' }).waitFor({ state: 'visible' });
        const hygiene = await api(context, '/api/nutrition-operations/hygiene-records?residentId=resident-a', actors.nutrition);
        hygieneId = (await hygiene.json()).items[0].record_id;
        await page.getByRole('button', { name: 'Ghi nhận lấy mẫu 24 giờ' }).click();
        await page.getByRole('status').filter({ hasText: 'Đã ghi nhận bền vững' }).waitFor({ state: 'visible' });
        const samples = await api(context, '/api/nutrition-operations/food-samples?residentId=resident-a', actors.nutrition);
        sampleId = (await samples.json()).items[0].sample_id;
        await page.reload();
        await page.getByText('Nghiệp vụ dinh dưỡng bền vững').waitFor({ state: 'visible' });
      } else {
        await page.getByRole('button', { name: 'Ghi nhận xuất khay' }).waitFor({ state: 'visible' });
      }
      if (errors.length) throw new Error(`${name} browser errors: ${errors.join('; ')}`);
      console.log(`${name.toUpperCase()}_KITCHEN_PERSISTENCE=PASS`);
      await context.close();
    }

    const caregiverContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const caregiver = await caregiverContext.newPage();
    await assume(caregiver, actors.caregiver);
    await caregiver.getByRole('button', { name: 'Xác nhận nhận khay' }).waitFor({ state: 'visible' });
    await caregiver.getByRole('button', { name: 'Ghi nhận xuất khay' }).count().then(count => { if (count !== 0) throw new Error('Caregiver saw dispatch control'); });
    await caregiver.getByLabel('Dispatch ID').fill(dispatchId);
    await caregiver.getByLabel('Assigned floor').fill('9');
    await caregiver.getByLabel('Received portions').fill('3');
    await caregiver.getByRole('button', { name: 'Xác nhận nhận khay' }).click();
    await caregiver.getByRole('status').filter({ hasText: /denied|không|assigned|phép/i }).waitFor({ state: 'visible' });
    await caregiver.getByLabel('Assigned floor').fill('2');
    await caregiver.getByLabel('Received portions').fill('2');
    await caregiver.getByRole('button', { name: 'Xác nhận nhận khay' }).click();
    await caregiver.getByRole('status').filter({ hasText: 'Đã ghi nhận bền vững' }).waitFor({ state: 'visible' });
    console.log('CAREGIVER_FLOOR_SCOPE_AND_RECEIPT=PASS');
    await caregiverContext.close();

    const managerContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const manager = await managerContext.newPage();
    await assume(manager, actors.manager);
    await manager.getByLabel('Hygiene record ID').fill(hygieneId);
    await manager.getByLabel('Sample ID').fill(sampleId);
    await manager.getByRole('button', { name: 'Kiểm tra vệ sinh' }).click();
    await manager.getByRole('status').filter({ hasText: 'Đã ghi nhận bền vững' }).waitFor({ state: 'visible' });
    await manager.getByRole('button', { name: 'Kiểm tra mẫu lưu' }).click();
    await manager.getByRole('status').filter({ hasText: 'Đã ghi nhận bền vững' }).waitFor({ state: 'visible' });
    console.log('MANAGER_INSPECTION=PASS');
    await managerContext.close();

    const boardContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const board = await boardContext.newPage();
    await assume(board, actors.board);
    if (await board.getByRole('button', { name: 'Ghi nhận xuất khay' }).count()) throw new Error('Readonly actor saw dispatch control');
    if (await board.getByRole('button', { name: 'Tự xác nhận vệ sinh' }).count()) throw new Error('Readonly actor saw hygiene write control');
    console.log('READONLY_ROLE_WRITE_CONTROLS=PASS');
    await boardContext.close();
  } finally { await browser.close(); }
}

main().catch(error => { console.error('BROWSER_E2E=FAIL'); console.error(error.message); process.exitCode = 1; });
