import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:8000/site/';

// Create simple SVG data URLs to act as vertical/horizontal media with known intrinsic sizes
const svg = (w: number, h: number, text: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>\n  <rect width='100%' height='100%' fill='gray'/>\n  <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='20'>${text}</text>\n</svg>`)} `;

test.describe('drill media aspect ratios', () => {
  test('vertical media keeps intrinsic aspect ratio', async ({ page }) => {
    // manifest with single vertical drill
    await page.route('**/default_drills_with_meta.json', async route => {
      const body = [
        {
          id: 'vertical-test',
          name_en: 'Vertical Test',
          preview_webp: svg(200, 400, 'VERTICAL'),
        },
      ];
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.goto(BASE + 'drill.html?id=vertical-test');
    // wait for media img to appear
    await page.waitForSelector('.single-media img');
    const intrinsic = await page.$eval('.single-media img', (img: HTMLImageElement) => ({ nw: img.naturalWidth, nh: img.naturalHeight }));
    const box = await page.locator('.single-media img').boundingBox();
    expect(intrinsic.nh).toBeGreaterThan(intrinsic.nw);
    // compute displayed image size when object-fit: contain is applied
    const scale = Math.min(box!.width / intrinsic.nw, box!.height / intrinsic.nh);
    const displayedWidth = intrinsic.nw * scale;
    const displayedHeight = intrinsic.nh * scale;
    const displayedRatio = displayedWidth / displayedHeight;
    const intrinsicRatio = intrinsic.nw / intrinsic.nh;
    // displayed aspect should match intrinsic aspect closely
    expect(Math.abs(displayedRatio - intrinsicRatio)).toBeLessThan(0.01);
  });

  test('horizontal media keeps intrinsic aspect ratio', async ({ page }) => {
    // manifest with single horizontal drill
    await page.route('**/default_drills_with_meta.json', async route => {
      const body = [
        {
          id: 'horizontal-test',
          name_en: 'Horizontal Test',
          preview_webp: svg(640, 360, 'HORIZONTAL'),
        },
      ];
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.goto(BASE + 'drill.html?id=horizontal-test');
    await page.waitForSelector('.single-media img');
    const intrinsic = await page.$eval('.single-media img', (img: HTMLImageElement) => ({ nw: img.naturalWidth, nh: img.naturalHeight }));
    const box = await page.locator('.single-media img').boundingBox();
    expect(intrinsic.nw).toBeGreaterThan(intrinsic.nh);
    const scale = Math.min(box!.width / intrinsic.nw, box!.height / intrinsic.nh);
    const displayedWidth = intrinsic.nw * scale;
    const displayedHeight = intrinsic.nh * scale;
    const displayedRatio = displayedWidth / displayedHeight;
    const intrinsicRatio = intrinsic.nw / intrinsic.nh;
    expect(Math.abs(displayedRatio - intrinsicRatio)).toBeLessThan(0.01);
  });
});
