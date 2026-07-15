import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:8000/site/';

test('drill page shows single drill view with navigation', async ({ page }) => {
  const manifestResp = await page.request.get(BASE + 'default_drills_with_meta.json');
  expect(manifestResp.ok()).toBeTruthy();
  const manifest = await manifestResp.json();
  expect(manifest.length).toBeGreaterThan(0);
  const first = manifest[0];

  const url = BASE + `drill.html?id=${encodeURIComponent(first.id)}`;
  await page.goto(url);
  await page.waitForSelector('.single-title');

  // ensure there are no .card elements on the single drill page
  const cards = await page.$$('.card');
  expect(cards.length).toBe(0);

  // verify title matches manifest (handle localized name objects)
  const title = await page.locator('.single-title').textContent();
  const expectedName =
    first.name_en ||
    (first.name && typeof first.name === 'object' ? first.name.en || first.name_en || Object.values(first.name)[0] : first.name) ||
    '';
  expect(title).toContain(expectedName);

  // check prev/next buttons exist and navigation works
  const prev = page.locator('#drill-prev');
  const next = page.locator('#drill-next');
  expect(await prev.count()).toBeGreaterThan(0);
  expect(await next.count()).toBeGreaterThan(0);

  if ((await next.count()) > 0 && manifest.length > 1) {
    const originalTitle = await page.locator('.single-title').textContent();
    await next.first().click();
    await expect(page.locator('.single-title')).not.toHaveText(originalTitle ?? '');
  }

  // Ensure title and actions are visible and actions fit within viewport
  const titleVisible = await page.locator('.single-title').isVisible();
  const actionsBox = await page.locator('.single-actions').boundingBox();
  const vp = await page.viewportSize();
  expect(titleVisible).toBeTruthy();
  if (actionsBox && vp) {
    // actions bottom should be <= viewport height
    expect(actionsBox.y + actionsBox.height).toBeLessThanOrEqual(vp.height + 2);
  }
});
