// Étape 4 du check-in : bouton « Valider », contrat PDF dans la langue du voyageur,
// et envoi au moment de la validation (pas au téléchargement). Supabase est simulé.
const path = require('path');
const { test, expect } = require('@playwright/test');

const SUPABASE_JS = path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
// jsPDF servi depuis node_modules (même version que le CDN) pour que les tests marchent hors ligne.
const JSPDF_JS = path.join(__dirname, '..', 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js');
const HOST_ID = '00000000-0000-0000-0000-0000000000b0';
const fakeHost = { id: HOST_ID, name: 'Hôte Test', link_id: 'l1', phone: '0600000000', cin: 'AB123456' };
const fakeProperty = { id: 'p1', host_id: HOST_ID, name: 'Riad Test', address: 'Marrakech', checkin_time: '15:00', checkout_time: '11:00' };

async function setup(page) {
  const calls = [];
  await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/2\.5\.1\/jspdf\.umd\.min\.js/, (route) =>
    route.fulfill({ path: JSPDF_JS, contentType: 'text/javascript' }));
  await page.route(/@supabase\/supabase-js@[^/]+\/dist\/umd\/supabase(\.min)?\.js/, (route) =>
    route.fulfill({ path: SUPABASE_JS, contentType: 'text/javascript' }));
  await page.route(/\.supabase\.co\//, async (route) => {
    const url = route.request().url();
    if (url.includes('/functions/v1/send-checkin-email')) calls.push('email');
    if (url.includes('/rest/v1/guests')) calls.push('save');
    const wantsOne = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object');
    let body = [];
    if (url.includes('/rest/v1/profiles_public')) body = [fakeHost];
    else if (url.includes('/rest/v1/properties_public')) body = [fakeProperty];
    else if (url.includes('/rest/v1/rpc/is_plan_active')) body = true;
    else if (url.includes('/rest/v1/guests')) body = [{ id: 'g1' }];
    else if (url.includes('/functions/v1/')) body = { success: true };
    else if (url.includes('/rest/v1/rpc/')) body = null;
    if (wantsOne && Array.isArray(body)) body = body[0] || null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/checkin.html?host=l1');
  await page.evaluate(() => {
    startDate = new Date(2026, 11, 20); endDate = new Date(2026, 11, 23);
    document.getElementById('docNumber').value = 'AB123456';
    document.getElementById('firstName').value = 'Anna';
    document.getElementById('lastName').value = 'Eriksson';
    document.getElementById('check4').checked = true; // consentement de l'étape 3
    currentStep = 4; buildContractSummary(); updateUI();
  });
  return calls;
}

async function sign(page) {
  await page.locator('#sigCanvas').scrollIntoViewIfNeeded();
  const box = await page.locator('#sigCanvas').boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 60, { steps: 5 });
  await page.mouse.up();
}

test('signer avant de cocher les cases : « Valider » se débloque', async ({ page }) => {
  await setup(page);
  await sign(page);
  await expect(page.locator('#btnSubmit')).toBeDisabled();
  // On coche en cliquant directement sur les cases (et non sur le texte).
  for (const id of ['#check1', '#check2', '#check3']) await page.click(id);
  await expect(page.locator('#check1')).toBeChecked();
  await expect(page.locator('#btnSubmit')).toBeEnabled();
});

test('cocher en cliquant sur le texte puis signer : « Valider » se débloque', async ({ page }) => {
  await setup(page);
  for (const id of ['check1', 'check2', 'check3']) await page.click(`.checkbox-row[onclick*="${id}"] span`);
  await expect(page.locator('#check2')).toBeChecked();
  await sign(page);
  await expect(page.locator('#btnSubmit')).toBeEnabled();
});

for (const [lang, expected, absent] of [
  ['fr', ['Contrat de location', 'Article 2', 'LE LOCATAIRE'], ['Rental contract']],
  ['en', ['Rental contract', 'Article 2', 'THE TENANT', 'IT HAS BEEN AGREED AS FOLLOWS'], ['Contrat de location']],
  ['es', ['Contrato de alquiler', 'EL ARRENDATARIO', 'ENTRE LOS ABAJO FIRMANTES'], ['Contrat de location']],
  ['ar', ['Contrat de location', 'LE LOCATAIRE'], ['Rental contract']],
]) {
  test(`contrat PDF en « ${lang} »`, async ({ page }) => {
    await setup(page);
    await page.evaluate((l) => setLang(l), lang);
    const b64 = await page.evaluate(() => generatePDFBase64());
    expect(b64).toBeTruthy();
    const pdf = Buffer.from(b64, 'base64').toString('latin1');
    for (const s of expected) expect(pdf).toContain(s);
    for (const s of absent) expect(pdf).not.toContain(s);
  });
}

test('l\'envoi se fait à la validation, pas au téléchargement', async ({ page }) => {
  const calls = await setup(page);
  await sign(page);
  for (const id of ['#check1', '#check2', '#check3']) await page.click(id);
  await page.click('#btnSubmit');
  await expect(page.locator('#page5')).toBeVisible();
  await expect.poll(() => calls.includes('email')).toBe(true);
  const before = calls.length;
  const dl = page.waitForEvent('download');
  await page.click('#btnPDF');
  await dl;
  expect(calls.length).toBe(before);
});
