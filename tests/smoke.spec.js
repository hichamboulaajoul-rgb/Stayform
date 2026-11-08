// Smoke tests: every page loads, renders its main content and throws no JavaScript errors.
// Calls to Supabase are intercepted so the tests never touch the production database.
const path = require('path');
const { test, expect } = require('@playwright/test');

// Serve supabase-js from node_modules instead of the CDN so tests work offline.
const SUPABASE_JS = path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');

const HOST_ID = '00000000-0000-0000-0000-0000000000b0';
const PROPERTY_ID = '00000000-0000-0000-0000-0000000000p1';

const fakeHost = { id: HOST_ID, name: 'Hôte Test', link_id: 'testlink', phone: '0600000000', cin: 'AB123456' };
const fakeProperty = {
  id: PROPERTY_ID, host_id: HOST_ID, name: 'Riad Test', address: 'Marrakech', cover_emoji: '🏡',
  checkin_time: '15:00', checkout_time: '11:00', rules: '', description: '', wifi_name: 'riad', wifi_password: 'x',
};

async function stubSupabase(page) {
  await page.route(/@supabase\/supabase-js@[^/]+\/dist\/umd\/supabase(\.min)?\.js/, (route) =>
    route.fulfill({ path: SUPABASE_JS, contentType: 'text/javascript' }));
  await page.route(/\.supabase\.co\//, async (route) => {
    const url = route.request().url();
    const wantsOne = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object');
    let body = [];
    if (url.includes('/rest/v1/profiles_public')) body = [fakeHost];
    else if (url.includes('/rest/v1/properties_public')) body = [fakeProperty];
    else if (url.includes('/rest/v1/rpc/is_plan_active')) body = true;
    else if (url.includes('/rest/v1/rpc/')) body = null;
    else if (url.includes('/auth/v1/')) body = {};
    if (wantsOne && Array.isArray(body)) body = body[0] || null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

const pages = [
  { path: '/index.html', title: /Stayform/ },
  { path: '/pricing.html', title: /Tarifs/ },
  { path: '/admin.html', title: /Admin/, visible: '#adminPassword' },
  { path: `/welcome.html?p=${PROPERTY_ID}&h=${HOST_ID}`, title: /Bienvenue/ },
  { path: '/checkin.html?host=testlink', title: /Check-in/, visible: '#sigArea' },
];

for (const p of pages) {
  test(`${p.path} loads without JavaScript errors`, async ({ page }) => {
    await stubSupabase(page);
    const errors = collectErrors(page);
    const res = await page.goto(p.path, { waitUntil: 'load' });
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle(p.title);
    if (p.visible) await expect(page.locator(p.visible)).toBeAttached();
    await page.waitForTimeout(500);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('payment success URL does not grant a plan from the browser', async ({ page }) => {
  await stubSupabase(page);
  const writes = [];
  page.on('request', (r) => {
    if (r.url().includes('/rest/v1/profiles') && ['PATCH', 'POST'].includes(r.method())) {
      const data = r.postData() || '';
      if (/"plan"\s*:/.test(data)) writes.push(data);
    }
  });
  await page.goto('/index.html?payment=success');
  await page.evaluate(() => typeof activatePremium === 'function' && (window.currentUser = { id: 'x' }));
  await page.evaluate(async () => {
    try { currentUser = { id: 'x', email: 'x@x' }; currentProfile = { plan: 'free' }; await activatePremium(); } catch (e) {}
  });
  expect(writes).toEqual([]);
});

// Airbnb renvoie parfois une page « Redirection vers www.airbnb.fr » au lieu de l'annonce.
// L'import ne doit jamais utiliser ce titre comme nom : il bascule sur le formulaire manuel
// en gardant le lien.
for (const scenario of [
  { label: 'old edge function (success with redirect title)', status: 200, body: { success: true, data: { name: 'Redirection vers www.airbnb.fr', amenities: [], rules: [] } } },
  { label: 'fixed edge function (airbnb_unreadable)', status: 502, body: { success: false, code: 'airbnb_unreadable', error: 'x' } },
]) {
  test(`Airbnb import falls back to manual form: ${scenario.label}`, async ({ page }) => {
    const errors = collectErrors(page);
    await stubSupabase(page);
    await page.route(/functions\/v1\/scrape-airbnb/, (route) =>
      route.fulfill({ status: scenario.status, contentType: 'application/json', body: JSON.stringify(scenario.body) }));
    await page.goto('/index.html');
    await page.evaluate(() => {
      document.getElementById('propertyModal').classList.add('open');
      document.getElementById('propStep1').style.display = 'block';
      document.getElementById('propAirbnb').value = 'https://www.airbnb.fr/rooms/45531030?source=x';
    });
    await page.evaluate(() => _importFromAirbnb());
    await expect(page.locator('#propStep3')).toBeVisible();
    await expect(page.locator('#propStep2')).toBeHidden();
    await expect(page.locator('#propName3')).toHaveValue('');
    expect(await page.evaluate(() => _pendingAirbnbUrl)).toBe('https://www.airbnb.com/rooms/45531030');
    expect(errors).toEqual([]);
  });
}
