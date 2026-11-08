// Guide de démarrage de l'hôte : carte en 4 étapes, fenêtre d'accueil et aperçu du contrat.
// Supabase est simulé : les tests ne touchent jamais la base de production.
const path = require('path');
const { test, expect } = require('@playwright/test');

const SUPABASE_JS = path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
const HOST_ID = '00000000-0000-0000-0000-0000000000b0';
const PROPERTY_ID = '11111111-2222-3333-4444-555555555555';

const property = {
  id: PROPERTY_ID, host_id: HOST_ID, name: 'Riad Test', address: 'Marrakech', cover_emoji: '🏡',
  checkin_time: '15:00', checkout_time: '11:00', wifi_name: 'riad', wifi_password: 'x',
};

async function stub(page, { profile, properties }) {
  await page.route(/@supabase\/supabase-js@[^/]+\/dist\/umd\/supabase(\.min)?\.js/, (route) =>
    route.fulfill({ path: SUPABASE_JS, contentType: 'text/javascript' }));
  await page.route(/\.supabase\.co\//, async (route) => {
    const url = route.request().url();
    const wantsOne = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object');
    let body = [];
    if (url.includes('/rest/v1/profiles')) body = [profile];
    else if (url.includes('/rest/v1/properties')) body = properties;
    else if (url.includes('/rest/v1/rpc/')) body = null;
    else if (url.includes('/auth/v1/')) body = {};
    if (wantsOne && Array.isArray(body)) body = body[0] || null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function openDashboard(page, opts) {
  await stub(page, opts);
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof sb !== 'undefined' && sb);
  await page.evaluate((id) => loadDashboard({ id, email: 'hote@test.ma' }), HOST_ID);
  return errors;
}

test('un nouvel hôte voit l\'accueil et la carte Démarrage à 0/4', async ({ page }) => {
  const errors = await openDashboard(page, {
    profile: { id: HOST_ID, name: 'Hicham Test', plan: 'free', guest_count: 0, link_id: 'l1' },
    properties: [],
  });
  await expect(page.locator('.onb-modal')).toBeVisible();
  await expect(page.locator('.onb-modal li')).toHaveCount(4);
  await page.click('.onb-modal [data-start]');
  // Étape 1 : la fenêtre d'ajout s'ouvre et le champ Airbnb est mis en surbrillance
  await expect(page.locator('#propAirbnb')).toHaveClass(/onb-spot/);
  await expect(page.locator('.onb-tip')).toContainText('Étape 1 sur 4');

  await page.evaluate(() => { closePropertyModal(); showSection('overview'); });
  await expect(page.locator('#onbCard')).toBeVisible();
  await expect(page.locator('#onbCard .onb-step')).toHaveCount(4);
  await expect(page.locator('#onbCard .onb-step.done')).toHaveCount(0);
  await expect(page.locator('#onbCard .onb-step.current')).toHaveAttribute('data-onb-step', 'property');

  // L'accueil ne revient pas au rechargement
  await page.reload();
  await page.waitForFunction(() => typeof sb !== 'undefined' && sb);
  await page.evaluate((id) => loadDashboard({ id, email: 'hote@test.ma' }), HOST_ID);
  await expect(page.locator('#onbCard')).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.locator('.onb-modal')).toHaveCount(0);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('la progression suit les données de l\'hôte', async ({ page }) => {
  const errors = await openDashboard(page, {
    profile: { id: HOST_ID, name: 'Hicham Test', plan: 'free', guest_count: 0, link_id: 'l1', cin: 'AB123456' },
    properties: [property],
  });
  await expect(page.locator('.onb-modal')).toContainText('Plus que 2 étapes');
  await page.locator('.onb-modal [data-later]').click();
  await expect(page.locator('#onbCard .onb-step.done')).toHaveCount(2);
  await expect(page.locator('#onbCard .onb-step.current')).toHaveAttribute('data-onb-step', 'link');

  // Étape 3 : ouvre la fiche du logement et pointe le bouton « Nouveau lien »
  await page.locator('#onbCard [data-onb-step="link"] .onb-go').click();
  await expect(page.locator('#section-property-detail')).toBeVisible();
  await expect(page.locator('.onb-spot')).toContainText('Nouveau lien');

  // Masquer le guide
  await page.evaluate(() => showSection('overview'));
  await page.locator('[data-onb-hide]').click();
  await expect(page.locator('#onbCard')).toBeHidden();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('un client existant revoit l\'accueil le lendemain tant que le guide n\'est pas fini', async ({ page }) => {
  const errors = await openDashboard(page, {
    profile: { id: HOST_ID, name: 'Hicham Test', plan: 'free', guest_count: 0, link_id: 'l1', cin: 'AB123456' },
    properties: [property],
  });
  await page.locator('.onb-modal [data-later]').click();
  // Simule une connexion le lendemain
  await page.evaluate((id) => {
    const k = 'sf_onb_' + id;
    const s = JSON.parse(localStorage.getItem(k));
    s.lastWelcome = '2000-01-01';
    localStorage.setItem(k, JSON.stringify(s));
  }, HOST_ID);
  await page.reload();
  await page.waitForFunction(() => typeof sb !== 'undefined' && sb);
  await page.evaluate((id) => loadDashboard({ id, email: 'hote@test.ma' }), HOST_ID);
  await expect(page.locator('.onb-modal')).toContainText('Bon retour');

  // « Masquer » met le guide en pause : pas d'accueil le lendemain
  await page.locator('.onb-modal [data-later]').click();
  await page.locator('[data-onb-hide]').click();
  await page.evaluate((id) => {
    const k = 'sf_onb_' + id;
    const s = JSON.parse(localStorage.getItem(k));
    s.lastWelcome = '2000-01-01';
    localStorage.setItem(k, JSON.stringify(s));
  }, HOST_ID);
  await page.reload();
  await page.waitForFunction(() => typeof sb !== 'undefined' && sb);
  await page.evaluate((id) => loadDashboard({ id, email: 'hote@test.ma' }), HOST_ID);
  await page.waitForTimeout(800);
  await expect(page.locator('.onb-modal')).toHaveCount(0);
  await expect(page.locator('#onbCard')).toBeHidden();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('le guide pas à pas est accessible depuis le menu et le bouton d\'aide', async ({ page }) => {
  const errors = await openDashboard(page, {
    profile: { id: HOST_ID, name: 'Hicham Test', plan: 'free', guest_count: 0, link_id: 'l1' },
    properties: [property],
  });
  await page.locator('.onb-modal [data-later]').click();
  await page.locator('#onbHelpFab').click();
  await expect(page.locator('#section-guide')).toBeVisible();
  await expect(page.locator('#section-guide .guide-step')).toHaveCount(4);
  await expect(page.locator('#section-guide .guide-step').nth(0)).toContainText('hébergement');
  await expect(page.locator('#section-guide .guide-step').nth(1)).toContainText('règles');
  await expect(page.locator('#section-guide .guide-step').nth(2)).toContainText('lien');
  await expect(page.locator('#section-guide .guide-step.is-done')).toHaveCount(1);

  // « Montrez-moi » sur l'étape règles ouvre l'hébergement et pointe le champ CNIE
  await page.locator('[data-guide-show="contract"]').click();
  await expect(page.locator('#section-property-detail')).toBeVisible();
  await expect(page.locator('#ct-host-cin')).toHaveClass(/onb-spot/);

  // Le menu y mène aussi, même quand le guide est masqué
  await page.evaluate(() => showSection('overview'));
  await page.locator('[data-onb-hide]').click();
  await page.evaluate(() => { const s = document.getElementById('sidebar'); if (s) s.classList.add('open'); });
  await page.locator('.nav-item', { hasText: 'Guide pas à pas' }).click();
  await expect(page.locator('#section-guide')).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('l\'exemple de contrat s\'ouvre sans toucher Supabase', async ({ page }) => {
  const calls = [];
  page.on('request', (r) => { if (r.url().includes('supabase.co')) calls.push(r.url()); });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/index.html');
  await page.evaluate((prop) => localStorage.setItem('sf_demo_contract', JSON.stringify({
    hostName: 'Hicham Test', hostCin: 'AB123456', hostPhone: '0600000000', property: prop,
  })), property);
  calls.length = 0;
  await page.goto('/checkin.html?demo=1');
  await expect(page.locator('#demoScreen')).toBeVisible();
  await expect(page.locator('#demoProp')).toHaveText('Riad Test');
  await expect(page.locator('#demoHost')).toHaveText('Hicham Test');
  await expect(page.locator('#demoMissing')).toBeHidden();

  const hasPdf = await page.evaluate(() => !!(window.jspdf && window.jspdf.jsPDF));
  if (hasPdf) {
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#demoPdfBtn')]);
    expect(download.suggestedFilename()).toBe('Exemple_contrat_Stayform.pdf');
  }
  expect(calls.filter((u) => u.includes('/rest/v1/'))).toEqual([]);
  expect(errors, errors.join('\n')).toEqual([]);
});
