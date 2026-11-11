// Scan de la pièce d'identité à l'étape 2 du check-in : c'est le scanner de
// l'étape 3 (caméra / galerie + verify-identity, simulée ici) qui est affiché à
// l'étape 2. Le formulaire est pré-rempli et l'étape 3 est déjà vérifiée.
const path = require('path');
const { test, expect } = require('@playwright/test');

const SUPABASE_JS = path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
const HOST_ID = '00000000-0000-0000-0000-0000000000b0';
const fakeHost = { id: HOST_ID, name: 'Hôte Test', link_id: 'l1', phone: '0600000000', cin: 'AB123456' };
const fakeProperty = { id: 'p1', host_id: HOST_ID, name: 'Riad Test', address: 'Marrakech', checkin_time: '15:00', checkout_time: '11:00' };
const photo = path.join(__dirname, '..', 'og-image.png');

// Réponses réelles de verify-identity (même forme).
const PASSPORT = {
  success: true, readable: true, verified: true, autoFill: true, detectedNum: 'L898902C3', docType: 'P',
  mrzData: { firstName: 'ANNA MARIA', lastName: 'ERIKSSON', nationality: 'FRA', birthDate: '740812', expiryDate: '120415', sex: 'F' },
};
const CIN_FRONT = {
  success: true, readable: true, verified: true, autoFill: true, detectedNum: 'BE123456', docType: 'CIN',
  latinNames: ['ROYAUME DU MAROC', 'YOUSSEF', 'EL ALAOUI'],
};

async function setup(page, visionResponse) {
  const calls = [];
  await page.route(/@supabase\/supabase-js@[^/]+\/dist\/umd\/supabase(\.min)?\.js/, (route) =>
    route.fulfill({ path: SUPABASE_JS, contentType: 'text/javascript' }));
  await page.route(/\.supabase\.co\//, async (route) => {
    const url = route.request().url();
    if (url.includes('/functions/v1/verify-identity')) {
      calls.push(JSON.parse(route.request().postData()));
      const r = visionResponse;
      return route.fulfill({ status: r.status || 200, contentType: 'application/json', body: JSON.stringify(r.body || r) });
    }
    const wantsOne = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object');
    let body = [];
    if (url.includes('/rest/v1/profiles_public')) body = [fakeHost];
    else if (url.includes('/rest/v1/properties_public')) body = [fakeProperty];
    else if (url.includes('/rest/v1/rpc/is_plan_active')) body = true;
    else if (url.includes('/rest/v1/rpc/')) body = null;
    if (wantsOne && Array.isArray(body)) body = body[0] || null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/checkin.html?host=l1');
  await page.evaluate(() => { currentStep = 2; updateUI(); });
  await expect(page.locator('#page2 #scannerSection')).toBeVisible();
  await expect(page.locator('#page2 #scanReady')).toBeVisible();
  return calls;
}

// Pas de caméra dans le navigateur de test : on passe par « photo depuis la galerie ».
async function scan(page) {
  await page.evaluate(() => showGalleryFallback());
  await page.setInputFiles('#file1', photo);
}

test('passeport : champs pré-remplis, étape 3 déjà vérifiée', async ({ page }) => {
  const calls = await setup(page, PASSPORT);
  await scan(page);
  await expect(page.locator('#idScanStatus')).toContainText('Identité vérifiée');
  await expect(page.locator('#idScanStatus')).toContainText('expiré');
  expect(calls).toHaveLength(1);
  expect(calls[0].imageBase64.length).toBeGreaterThan(100);
  await expect(page.locator('#page2 #scanSuccess')).toBeVisible();
  await expect(page.locator('#docNumber')).toHaveValue('L898902C3');
  await expect(page.locator('#firstName')).toHaveValue('Anna Maria');
  await expect(page.locator('#lastName')).toHaveValue('Eriksson');
  await expect(page.locator('#nationality')).toHaveValue('Française');
  await expect(page.locator('#birthdate')).toHaveValue('12/08/1974');
  await expect(page.locator('#docTypeIdentity')).toHaveValue('passport');
  await expect(page.locator('#firstName')).toHaveClass(/id-scan-filled/);

  // E-mail facultatif : on passe à l'étape 3 sans le remplir.
  await page.evaluate(() => nextStep(2));
  await expect(page.locator('#page3 #scannerSection')).toBeVisible();
  await expect(page.locator('#scanSuccess')).toBeVisible();
  await expect(page.locator('#scanSuccessDetails')).toContainText('étape précédente');
  await expect(page.locator('#scanReady')).toBeHidden();
  await expect(page.locator('#cinCaptured')).toBeVisible();
  // Seul le consentement reste à cocher : pas de second scan.
  await expect(page.locator('#btn3')).toBeDisabled();
  await page.evaluate(() => { document.getElementById('check4').checked = true; checkStep3(); });
  await expect(page.locator('#btn3')).toBeEnabled();
  expect(calls).toHaveLength(1);
});

test('recto de CIN : numéro et nom remplis, le reste à compléter', async ({ page }) => {
  await setup(page, CIN_FRONT);
  await scan(page);
  await expect(page.locator('#idScanStatus')).toContainText('date de naissance');
  await expect(page.locator('#docNumber')).toHaveValue('BE123456');
  await expect(page.locator('#firstName')).toHaveValue('Youssef');
  await expect(page.locator('#lastName')).toHaveValue('El Alaoui');
  await expect(page.locator('#docTypeIdentity')).toHaveValue('cin');
});

test('numéro modifié après le scan : l\'étape 3 redemande un scan', async ({ page }) => {
  await setup(page, CIN_FRONT);
  await scan(page);
  await expect(page.locator('#docNumber')).toHaveValue('BE123456');
  await page.fill('#docNumber', 'XY999999');
  await expect(page.locator('#idScanStatus')).toContainText('modifié le numéro');
  expect(await page.evaluate(() => cinVerified)).toBe(false);
  await expect(page.locator('#scanReady')).toBeAttached();
  expect(await page.evaluate(() => document.getElementById('scanReady').style.display)).toBe('block');
});

test('document non reconnu : message clair, formulaire manuel intact', async ({ page }) => {
  await setup(page, { success: true, readable: true, verified: false, detectedNum: '' });
  await page.fill('#firstName', 'Karim');
  await scan(page);
  await expect(page.locator('#ocrStatus')).toContainText('non reconnu');
  await expect(page.locator('#firstName')).toHaveValue('Karim');
  expect(await page.evaluate(() => cinVerified)).toBe(false);
});

test('sans scan à l\'étape 2 : le scanner revient à l\'étape 3', async ({ page }) => {
  await setup(page, PASSPORT);
  await page.fill('#docNumber', 'AB123456');
  await page.fill('#firstName', 'Karim');
  await page.fill('#lastName', 'Benali');
  await page.evaluate(() => nextStep(2));
  await expect(page.locator('#page3 #scanReady')).toBeVisible();
  expect(await page.evaluate(() => cinVerified)).toBe(false);
});
