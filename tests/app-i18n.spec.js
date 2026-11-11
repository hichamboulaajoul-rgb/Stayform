// Traduction de la page d'accueil, de l'espace hôte et des tarifs (app-i18n.js).
// Supabase n'est pas contacté : les tests ne touchent jamais la base de production.
const { test, expect } = require('@playwright/test');

async function noSupabase(page) {
  await page.route(/supabase/, (r) => r.abort());
}

test('français par défaut : la page n’est pas modifiée', async ({ page }) => {
  await noSupabase(page);
  await page.goto('/index.html');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('#landingScreen')).toContainText('Fini les galères du check-in papier');
});

test('anglais : landing, placeholders et titre traduits', async ({ page }) => {
  await noSupabase(page);
  await page.goto('/index.html?lang=en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const land = page.locator('#landingScreen');
  await expect(land).toContainText('No more paper check-in hassle');
  await expect(land).toContainText('Check-in in 4 languages');
  await expect(land).not.toContainText('Fini les galères');
  await expect(page.locator('#loginEmail')).toHaveAttribute('placeholder', 'you@email.com');
  await expect(page).toHaveTitle(/Digital check-in for hosts/);
});

test('texte ajouté plus tard par le JavaScript, avec un nombre', async ({ page }) => {
  await noSupabase(page);
  await page.goto('/index.html?lang=es');
  const txt = await page.evaluate(async () => {
    const d = document.createElement('div');
    d.textContent = 'Étape 2 sur 4';
    document.body.appendChild(d);
    await new Promise((r) => setTimeout(r, 50));
    return d.textContent;
  });
  expect(txt).toBe('Paso 2 de 4');
});

test('les champs de saisie et data-no-i18n ne sont jamais traduits', async ({ page }) => {
  await noSupabase(page);
  await page.goto('/index.html?lang=en');
  const res = await page.evaluate(async () => {
    const t = document.createElement('textarea'); t.textContent = 'Mot de passe';
    const k = document.createElement('div'); k.setAttribute('data-no-i18n', ''); k.textContent = 'Mot de passe';
    document.body.append(t, k);
    await new Promise((r) => setTimeout(r, 50));
    return [t.value, k.textContent];
  });
  expect(res).toEqual(['Mot de passe', 'Mot de passe']);
});

test('arabe : de droite à gauche, et le choix de langue est gardé', async ({ page }) => {
  await noSupabase(page);
  await page.goto('/index.html');
  await page.selectOption('.lp-lang select', 'ar');
  await page.waitForLoadState('load');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#landingScreen')).toContainText('وداعاً لمتاعب تسجيل الوصول الورقي');
  await page.goto('/pricing.html');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('body')).toContainText('الأسعار');
});
