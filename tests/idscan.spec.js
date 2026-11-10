// Scan de la pièce d'identité à l'étape 2 du check-in : la MRZ est lue dans le
// navigateur et recopiée dans le formulaire. Tesseract est remplacé par un faux
// moteur pour que les tests restent hors ligne ; Supabase est simulé.
const path = require('path');
const { test, expect } = require('@playwright/test');

const SUPABASE_JS = path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
const HOST_ID = '00000000-0000-0000-0000-0000000000b0';
const fakeHost = { id: HOST_ID, name: 'Hôte Test', link_id: 'l1', phone: '0600000000', cin: 'AB123456' };
const fakeProperty = { id: 'p1', host_id: HOST_ID, name: 'Riad Test', address: 'Marrakech', checkin_time: '15:00', checkout_time: '11:00' };

// Spécimens ICAO 9303 + une CNIE marocaine fictive (chiffres de contrôle valides).
const PASSPORT = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10';
const CNIE = 'IDMARA123456784BE123456<<<<<<<\n9002155M3101012MAR<<<<<<<<<<<0\nEL<ALAOUI<<YOUSSEF<<<<<<<<<<<<';

async function setup(page, ocrTexts) {
  await page.addInitScript((texts) => {
    window.__ocrCalls = 0;
    window.Tesseract = {
      createWorker: async () => ({
        setParameters: async () => {},
        recognize: async () => ({ data: { text: texts[Math.min(window.__ocrCalls++, texts.length - 1)] } }),
      }),
    };
  }, ocrTexts);
  await page.route(/cdn\.jsdelivr\.net/, (route) => route.abort());
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
    if (wantsOne && Array.isArray(body)) body = body[0] || null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/checkin.html?host=l1');
  await page.evaluate(() => { currentStep = 2; updateUI(); });
  await expect(page.locator('#idScanBtn')).toBeVisible();
}

// N'importe quelle image fait l'affaire : le faux moteur ne la lit pas.
const photo = path.join(__dirname, '..', 'og-image.png');

test('passeport : les champs sont pré-remplis et signalés', async ({ page }) => {
  await setup(page, [PASSPORT]);
  await page.setInputFiles('#idScanInput', photo);
  await expect(page.locator('#idScanStatus')).toContainText('Document lu');
  await expect(page.locator('#idScanStatus')).toContainText('expiré');
  await expect(page.locator('#docNumber')).toHaveValue('L898902C3');
  await expect(page.locator('#firstName')).toHaveValue('Anna Maria');
  await expect(page.locator('#lastName')).toHaveValue('Eriksson');
  await expect(page.locator('#birthdate')).toHaveValue('12/08/1974');
  await expect(page.locator('#docTypeIdentity')).toHaveValue('passport');
  await expect(page.locator('#docType')).toHaveValue('passport');
  await expect(page.locator('#firstName')).toHaveClass(/id-scan-filled/);
  // Le voyageur corrige un champ : le surlignage disparaît.
  await page.fill('#firstName', 'Anna');
  await expect(page.locator('#firstName')).not.toHaveClass(/id-scan-filled/);
});

test('CNIE marocaine : numéro de CIN et nationalité', async ({ page }) => {
  await setup(page, [CNIE]);
  await page.setInputFiles('#idScanInput', photo);
  await expect(page.locator('#idScanStatus')).toContainText('Document lu');
  await expect(page.locator('#docNumber')).toHaveValue('BE123456');
  await expect(page.locator('#lastName')).toHaveValue('El Alaoui');
  await expect(page.locator('#nationality')).toHaveValue('Marocaine');
  await expect(page.locator('#docTypeIdentity')).toHaveValue('cin');
});

test('photo illisible : message clair, formulaire manuel intact', async ({ page }) => {
  await setup(page, ['ROYAUME DU MAROC\nrien de lisible']);
  await page.fill('#firstName', 'Karim');
  await page.setInputFiles('#idScanInput', photo);
  await expect(page.locator('#idScanStatus')).toContainText('Lecture impossible');
  await expect(page.locator('#firstName')).toHaveValue('Karim');
  await expect(page.locator('#idScanBtn')).toBeEnabled();
});

test('moteur OCR injoignable : on propose la saisie manuelle', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'Tesseract', { get: () => undefined, set: () => {} }); });
  await setup(page, []);
  await page.setInputFiles('#idScanInput', photo);
  await expect(page.locator('#idScanStatus')).toContainText('pas pu être chargé');
});
