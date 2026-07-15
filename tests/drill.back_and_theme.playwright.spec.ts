import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:8000/site/';

test('drill page respects persisted theme and back button returns to index', async ({ page }) => {
  const manifestResp = await page.request.get(BASE + 'default_drills_with_meta.json');
  expect(manifestResp.ok()).toBeTruthy();
  const manifest = await manifestResp.json();
  expect(manifest.length).toBeGreaterThan(0);
  const first = manifest[0];

  // persist dark theme before page load so drill.html reads it on startup
  await page.addInitScript(() => {
    try {
      localStorage.setItem('bbdrills_ui_v1', JSON.stringify({ theme: 'dark', lang: 'en' }));
    } catch (e) {}
  });

  const url = BASE + `drill.html?id=${encodeURIComponent(first.id)}`;
  await page.goto(url);
  await page.waitForSelector('.single-title');

  // documentElement should reflect persisted theme
  const themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  expect(themeAttr === 'dark' || themeAttr === 'light' || themeAttr === null).toBeTruthy();
  expect(themeAttr).toBe('dark');

  // click back link and ensure index.html loads with cards visible
  const back = page.locator('a[aria-label="Back to list"]');
  await expect(back).toHaveCount(1);
  await back.first().click();
  await page.waitForURL(url => url && /index\.html/.test(String(url)));
  await page.waitForSelector('.card');
  const cards = await page.$$('.card');
  expect(cards.length).toBeGreaterThan(0);
});
