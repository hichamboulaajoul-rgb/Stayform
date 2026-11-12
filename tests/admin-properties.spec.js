// Onglet « Propriétés » de l'admin : toutes les propriétés avec leur hôte et le lien Airbnb.
const path = require('path');
const { test, expect } = require('@playwright/test');

const SUPABASE_JS = path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
const HOST_ID = '00000000-0000-0000-0000-0000000000b0';
const OTHER_ID = '00000000-0000-0000-0000-0000000000c0';

const profiles = [
  { id: HOST_ID, name: 'Hôte <b>Test</b>', email: 'hote@test.ma', plan: 'free', created_at: '2026-10-01T10:00:00Z' },
  { id: OTHER_ID, name: 'Autre Hôte', email: 'autre@test.ma', plan: 'paid', created_at: '2026-10-02T10:00:00Z' },
];
const properties = [
  { id: 'p1', host_id: HOST_ID, name: 'Riad Médina', city: 'Marrakech', address: 'Derb 12', cover_emoji: '🕌', airbnb_url: 'https://www.airbnb.com/rooms/123', created_at: '2026-10-05T10:00:00Z' },
  { id: 'p2', host_id: OTHER_ID, name: 'Appart Plage', city: 'Agadir', airbnb_url: '', created_at: '2026-10-06T10:00:00Z' },
  { id: 'p3', host_id: OTHER_ID, name: 'Piège', city: 'Rabat', airbnb_url: 'javascript:alert(1)', created_at: '2026-10-04T10:00:00Z' },
];

async function stub(page) {
  await page.route(/@supabase\/supabase-js@[^/]+\/dist\/umd\/supabase(\.min)?\.js/, (route) =>
    route.fulfill({ path: SUPABASE_JS, contentType: 'text/javascript' }));
  await page.route(/\.supabase\.co\//, async (route) => {
    const url = route.request().url();
    let body = [];
    if (url.includes('/rest/v1/properties')) body = properties;
    else if (url.includes('/rest/v1/profiles')) body = profiles;
    else if (url.includes('/rest/v1/rpc/')) body = null;
    else if (url.includes('/auth/v1/')) body = {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('admin properties tab lists every property with its host and Airbnb link', async ({ page }) => {
  await stub(page);
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/admin.html');
  await page.evaluate(() => {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminScreen').style.display = 'block';
  });
  await page.evaluate(() => loadUsers());
  await page.click('#tab-properties');
  const rows = page.locator('#propertiesBody tr');
  await expect(rows).toHaveCount(3);
  await expect(page.locator('#propStatTotal')).toHaveText('3');
  await expect(page.locator('#propStatAirbnb')).toHaveText('1');
  await expect(page.locator('#propStatHosts')).toHaveText('2');
  // Plus récente en premier, hôte affiché (échappé)
  await expect(rows.nth(0)).toContainText('Appart Plage');
  await expect(rows.nth(1)).toContainText('Hôte <b>Test</b>');
  await expect(rows.nth(1).locator('a')).toHaveAttribute('href', 'https://www.airbnb.com/rooms/123');
  // Pas de lien pour une URL vide ou dangereuse
  await expect(page.locator('#propertiesBody a')).toHaveCount(1);

  await page.click('#propfilter-airbnb');
  await expect(rows).toHaveCount(1);
  await page.click('#propfilter-all');
  await page.fill('#propSearch', 'autre@test');
  await expect(rows).toHaveCount(2);
  expect(errors).toEqual([]);
});
