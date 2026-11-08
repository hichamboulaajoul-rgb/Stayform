// Affichage mobile : aucune page ne doit déborder horizontalement sur un téléphone (390 px).
// Supabase est simulé : les tests ne touchent jamais la base de production.
const path = require('path');
const { test, expect } = require('@playwright/test');

const SUPABASE_JS = path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
const HOST_ID = '00000000-0000-0000-0000-0000000000b0';
const PROPERTY_ID = '11111111-2222-3333-4444-555555555555';

const profile = { id: HOST_ID, name: 'Hôte Test', email: 'hote@test.ma', plan: 'free', guest_count: 2, link_id: 'l1', cin: 'AB123456', phone: '0600000000', created_at: '2026-10-01T10:00:00Z' };
const property = {
  id: PROPERTY_ID, host_id: HOST_ID, name: 'Riad avec un nom assez long', address: 'Derb Sidi Bouloukat, Marrakech', cover_emoji: '🏡',
  checkin_time: '15:00', checkout_time: '11:00', wifi_name: 'riad', wifi_password: 'x',
};
const guests = [
  { id: 'g1', name: 'Sarah Martin', email: 'sarah.martin.longue.adresse@example.com', phone: '+33600000000', nationality: 'Française', doc_number: 'AB123450', dates: '01/11 → 05/11', nights: 4, guest_count: 2, lock_code: '4802', signed: true, status: 'complete', property_name: property.name, property_id: PROPERTY_ID, created_at: '2026-11-01T10:00:00Z' },
  { id: 'g2', name: '<b>Karim</b> Benali', email: 'karim@example.com', phone: '+212600000000', nationality: 'Marocaine', doc_number: 'X1', dates: '06/11 → 08/11', nights: 2, guest_count: 1, signed: false, status: 'pending', property_name: 'Autre logement', property_id: 'p2', created_at: '2026-11-05T10:00:00Z' },
];

async function stub(page) {
  await page.route(/@supabase\/supabase-js@[^/]+\/dist\/umd\/supabase(\.min)?\.js/, (route) =>
    route.fulfill({ path: SUPABASE_JS, contentType: 'text/javascript' }));
  await page.route(/\.supabase\.co\//, async (route) => {
    const url = route.request().url();
    const wantsOne = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object');
    let body = [];
    if (url.includes('/rest/v1/profiles')) body = [profile];
    else if (url.includes('/rest/v1/properties')) body = [property];
    else if (url.includes('/rest/v1/guests')) body = guests;
    else if (url.includes('/rest/v1/rpc/is_plan_active')) body = true;
    else if (url.includes('/rest/v1/rpc/')) body = null;
    else if (url.includes('/auth/v1/')) body = {};
    if (wantsOne && Array.isArray(body)) body = body[0] || null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function pageWidth(page) {
  return page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
}

async function openDashboard(page, section) {
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof sb !== 'undefined' && sb);
  await page.evaluate((id) => loadDashboard({ id, email: 'hote@test.ma' }), HOST_ID);
  await page.evaluate(() => document.querySelectorAll('.onb-modal-bg').forEach((e) => e.remove()));
  await page.evaluate((s) => showSection(s), section);
  await page.waitForTimeout(400);
}

test.use({ viewport: { width: 390, height: 844 } });

const publicPages = ['/index.html', '/pricing.html', '/checkin.html?host=l1', `/welcome.html?p=${PROPERTY_ID}&h=${HOST_ID}`, '/admin.html'];

for (const url of publicPages) {
  test(`${url} ne déborde pas sur téléphone`, async ({ page }) => {
    await stub(page);
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const w = await pageWidth(page);
    expect(w.scroll, `largeur de page ${w.scroll}px pour un écran de ${w.client}px`).toBeLessThanOrEqual(w.client);
  });
}

for (const section of ['overview', 'properties', 'guests', 'settings']) {
  test(`tableau de bord « ${section} » ne déborde pas sur téléphone`, async ({ page }) => {
    await stub(page);
    await openDashboard(page, section);
    const w = await pageWidth(page);
    expect(w.scroll, `largeur de page ${w.scroll}px pour un écran de ${w.client}px`).toBeLessThanOrEqual(w.client);
  });
}

test('admin : le tableau des utilisateurs défile dans son cadre', async ({ page }) => {
  await stub(page);
  await page.goto('/admin.html');
  await page.evaluate(() => {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminScreen').style.display = 'block';
  });
  await page.evaluate(() => loadUsers());
  await page.waitForTimeout(400);
  const w = await pageWidth(page);
  expect(w.scroll).toBeLessThanOrEqual(w.client);
});

test('Mes guests : recherche, filtre par statut et noms échappés', async ({ page }) => {
  await stub(page);
  await openDashboard(page, 'guests');
  const cards = page.locator('#allGuestsWrap .guest-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(1)).toContainText('<b>Karim</b> Benali');
  await page.fill('#guestSearch', 'sarah');
  await expect(cards.filter({ visible: true })).toHaveCount(1);
  await page.fill('#guestSearch', 'personne');
  await expect(page.locator('#guestFilterEmpty')).toBeVisible();
  await page.fill('#guestSearch', '');
  await page.selectOption('#guestStatusFilter', 'pending');
  await expect(cards.filter({ visible: true })).toHaveCount(1);
  await expect(cards.filter({ visible: true })).toContainText('Karim');
});

test('check-in : un message explique pourquoi « Continuer » est grisé', async ({ page }) => {
  await stub(page);
  await page.goto('/checkin.html?host=l1');
  await expect(page.locator('#btn1')).toBeDisabled();
  await expect(page.locator('#btn1Hint')).toContainText('Choisissez vos dates');
});
