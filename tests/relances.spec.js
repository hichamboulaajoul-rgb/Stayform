// Onglet « Relances » de l'admin : liste des hôtes sans contrat et envoi via la fonction relance-hotes.
// Supabase et la fonction sont simulés.
const path = require('path');
const { test, expect } = require('@playwright/test');

const SUPABASE_JS = path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

const candidates = [
  { id: 'a1', email: 'amina@test.ma', name: 'Amina <b>B</b>', created_at: daysAgo(20), last_sent: null },
  { id: 'b2', email: 'youssef@test.ma', name: 'Youssef', created_at: daysAgo(15), last_sent: daysAgo(2) },
  { id: 'c3', email: 'karim@test.ma', name: 'Karim', created_at: daysAgo(10), last_sent: daysAgo(30) },
];

async function stub(page, calls) {
  await page.route(/@supabase\/supabase-js@[^/]+\/dist\/umd\/supabase(\.min)?\.js/, (route) =>
    route.fulfill({ path: SUPABASE_JS, contentType: 'text/javascript' }));
  await page.route(/\.supabase\.co\//, async (route) => {
    const req = route.request();
    const url = req.url();
    let body = [];
    if (url.includes('/functions/v1/relance-hotes')) {
      const payload = JSON.parse(req.postData() || '{}');
      calls.push(payload);
      body = payload.action === 'send'
        ? { sent: payload.user_ids.length, skipped: 0, failed: 0 }
        : { candidates, sample: { subject: 'Prénom, votre premier contrat', html: '<p>Bonjour Prénom,</p>' }, from: 'Hicham de Stayform <noreply@stayform.link>', reply_to: 'admin@test.ma', wait_days: 7, max: 100 };
    } else if (url.includes('/auth/v1/')) body = {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('relances tab lists hosts without contract and sends to the selected ones', async ({ page }) => {
  const calls = [];
  await stub(page, calls);
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/admin.html');
  await page.waitForFunction(() => typeof sb !== 'undefined' && sb);
  await page.evaluate(() => {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminScreen').style.display = 'block';
    showView('relances');
  });
  const rows = page.locator('#relanceBody tr');
  await expect(rows).toHaveCount(3);
  await expect(page.locator('#relanceBody')).toContainText('Amina <b>B</b>'); // échappé, pas interprété
  await expect(page.locator('#relanceReplyTo')).toHaveText('admin@test.ma');
  // Youssef relancé il y a 2 jours : décoché et désactivé
  await expect(rows.nth(1).locator('input')).toBeDisabled();
  await expect(page.locator('#relanceSendBtn')).toHaveText('Envoyer à 2 hôtes');

  await page.locator('button', { hasText: "Aperçu de l'e-mail" }).click();
  await expect(page.locator('#relancePreviewModal')).toHaveClass(/open/);
  await expect(page.frameLocator('#relancePreviewFrame').locator('p')).toHaveText('Bonjour Prénom,');
  await page.locator('#relancePreviewModal .modal-close').click();

  await rows.nth(2).locator('input').uncheck();
  await expect(page.locator('#relanceSendBtn')).toHaveText('Envoyer à 1 hôte');
  page.once('dialog', (d) => d.accept());
  await page.locator('#relanceSendBtn').click();
  await expect.poll(() => calls.filter((c) => c.action === 'send').length).toBe(1);
  expect(calls.find((c) => c.action === 'send').user_ids).toEqual(['a1']);
  expect(errors).toEqual([]);
});
