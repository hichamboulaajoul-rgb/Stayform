// Check-in voyageur multilingue : FR / EN / ES / AR (droite à gauche).
// Supabase est simulé : les tests ne touchent jamais la base de production.
const { test, expect } = require('@playwright/test');

const profile = { id: 'h1', name: 'Hôte Test', link_id: 'l1', cin: 'AB1', phone: '06' };
const property = { id: '11111111-2222-3333-4444-555555555555', host_id: 'h1', name: 'Riad Test', address: 'Marrakech', checkin_time: '15:00', quiet_hours_start: '22:00', quiet_hours_end: '08:00' };

async function stub(page) {
  await page.route(/\.supabase\.co\//, async (route) => {
    const url = route.request().url();
    let body = [];
    if (url.includes('/rest/v1/profiles')) body = [profile];
    else if (url.includes('/rest/v1/properties')) body = [property];
    else if (url.includes('/rest/v1/rpc/is_plan_active')) body = true;
    else if (url.includes('/rest/v1/rpc/')) body = null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test.describe('navigateur en espagnol', () => {
  test.use({ locale: 'es-ES' });
  test('la page s’ouvre en espagnol', async ({ page }) => {
    await stub(page);
    await page.goto('/checkin.html?host=l1');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('#hdr-title')).toHaveText('Check-in online');
    await expect(page.locator('#btn1Hint')).toContainText('Elige tus fechas');
    await expect(page.locator('#calTitle')).toHaveText(/Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre/);
    await expect(page.locator('.lang-btn[data-lang="es"]')).toHaveClass(/active/);
  });
});

test.describe('navigateur en arabe', () => {
  test.use({ locale: 'ar-MA' });
  test('la page passe de droite à gauche', async ({ page }) => {
    await stub(page);
    await page.goto('/checkin.html?host=l1&arr=2026-12-01&dep=2026-12-04');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-i18n="step1"]')).toHaveText('الإقامة');
    await expect(page.locator('#nightsBadge')).toContainText('3 ليالٍ');
  });
});

test('le voyageur change de langue, le choix est gardé, les données restent en français', async ({ page }) => {
  await stub(page);
  const token = 'l1.' + (Date.now() + 3600000).toString(36) + '.11111111';
  await page.goto('/checkin.html?t=' + token + '&arr=2026-12-01&dep=2026-12-04');
  await expect(page.locator('#hdr-title')).toHaveText('Check-in en ligne');
  await expect(page.locator('#contract-art6')).toContainText('Heures calmes : de 22:00 à 08:00');
  await page.click('.lang-btn[data-lang="en"]');
  await expect(page.locator('#hdr-title')).toHaveText('Online check-in');
  await expect(page.locator('#nightsBadge')).toContainText('3 nights');
  await expect(page.locator('#contract-art6')).toContainText('Quiet hours: from 22:00 to 08:00');
  await page.selectOption('#arrivalTime', { label: 'After 20:00' });
  await expect(page.locator('#arrivalTime')).toHaveValue('Après 20h00');
  await page.evaluate(() => changeCount('adults', 1));
  await expect(page.locator('#guestCount')).toHaveValue('2 adultes');
  await expect(page.locator('.companion-title')).toHaveText('Adult 2');
  await page.locator('#compFirstName0').evaluate((el) => { el.value = 'Sam'; });
  await page.click('.lang-btn[data-lang="ar"]');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#compFirstName0')).toHaveValue('Sam');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
});

test('lien expiré affiché dans la langue du voyageur', async ({ page }) => {
  await page.goto('/checkin.html?lang=en');
  await expect(page.locator('h1')).toHaveText(/Access denied/);
});
