// Suivi d'activité : le tableau de bord enregistre connexions et pages visitées,
// et l'onglet « Activité » de l'admin les affiche. Supabase est simulé.
const path = require('path');
const { test, expect } = require('@playwright/test');

const SUPABASE_JS = path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
const HOST_ID = '00000000-0000-0000-0000-0000000000b0';
const OTHER_ID = '00000000-0000-0000-0000-0000000000c0';

const profiles = [
  { id: HOST_ID, name: 'Hôte <b>Test</b>', email: 'hote@test.ma', plan: 'free', created_at: '2026-10-01T10:00:00Z' },
  { id: OTHER_ID, name: 'Autre Hôte', email: 'autre@test.ma', plan: 'paid', created_at: '2026-10-02T10:00:00Z' },
];

function minutesAgo(m) { return new Date(Date.now() - m * 60000).toISOString(); }

const activity = [
  { user_id: HOST_ID, event: 'page_view', page: 'guests', user_agent: 'Mozilla/5.0 (iPhone)', created_at: minutesAgo(5) },
  { user_id: HOST_ID, event: 'page_view', page: 'guests', user_agent: 'Mozilla/5.0 (iPhone)', created_at: minutesAgo(6) },
  { user_id: HOST_ID, event: 'page_view', page: 'overview', user_agent: 'Mozilla/5.0 (iPhone)', created_at: minutesAgo(7) },
  { user_id: HOST_ID, event: 'login', page: null, user_agent: 'Mozilla/5.0 (iPhone)', created_at: minutesAgo(7) },
  { user_id: OTHER_ID, event: 'login', page: null, user_agent: 'Mozilla/5.0 (Windows NT 10.0)', created_at: minutesAgo(120) },
];

async function stub(page, rpcCalls) {
  await page.route(/@supabase\/supabase-js@[^/]+\/dist\/umd\/supabase(\.min)?\.js/, (route) =>
    route.fulfill({ path: SUPABASE_JS, contentType: 'text/javascript' }));
  await page.route(/\.supabase\.co\//, async (route) => {
    const req = route.request();
    const url = req.url();
    const wantsOne = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    let body = [];
    if (url.includes('/rest/v1/rpc/log_activity')) { rpcCalls.push(JSON.parse(req.postData() || '{}')); body = null; }
    else if (url.includes('/rest/v1/host_activity')) body = activity;
    else if (url.includes('/rest/v1/profiles')) body = profiles;
    else if (url.includes('/rest/v1/rpc/')) body = null;
    else if (url.includes('/auth/v1/')) body = {};
    if (wantsOne && Array.isArray(body)) body = body[0] || null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('dashboard logs one login per tab and each section visited', async ({ page }) => {
  const calls = [];
  await stub(page, calls);
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof sb !== 'undefined' && sb);
  await page.evaluate((id) => loadDashboard({ id, email: 'hote@test.ma' }), HOST_ID);
  await page.evaluate(() => showSection('guests'));
  await page.evaluate(() => showSection('guests')); // double-clic : ignoré
  await page.evaluate(() => showSection('properties'));
  await page.evaluate((id) => loadDashboard({ id, email: 'hote@test.ma' }), HOST_ID); // pas de 2e connexion
  await expect.poll(() => calls.length).toBeGreaterThanOrEqual(4);
  await page.waitForTimeout(300);
  expect(calls.filter((c) => c.p_event === 'login')).toHaveLength(1);
  expect(calls.filter((c) => c.p_event === 'page_view').map((c) => c.p_page)).toEqual(['overview', 'guests', 'properties', 'overview']);
  expect(errors).toEqual([]);
});

test('admin activity tab lists hosts and the activity log', async ({ page }) => {
  await stub(page, []);
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/admin.html');
  await page.evaluate(() => {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminScreen').style.display = 'block';
  });
  await page.evaluate(() => loadUsers());
  await page.click('#tab-activity');
  await expect(page.locator('#activityHostsBody tr')).toHaveCount(2);
  await expect(page.locator('#actStatHosts')).toHaveText('2');
  await expect(page.locator('#actStatLogins')).toHaveText('2');
  await expect(page.locator('#actStatViews')).toHaveText('3');
  await expect(page.locator('#actStatTop')).toHaveText('Voyageurs');
  // Les noms sont échappés
  await expect(page.locator('#activityHostsBody tr').first()).toContainText('Hôte <b>Test</b>');
  await expect(page.locator('#activityLogBody tr')).toHaveCount(5);
  // Cliquer sur un hôte filtre le journal
  await page.locator('#activityHostsBody tr', { hasText: 'Autre Hôte' }).click();
  await expect(page.locator('#activityLogBody tr')).toHaveCount(1);
  await expect(page.locator('#activityLogBody')).toContainText('Ordinateur');
  expect(errors).toEqual([]);
});
