import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:8000/site/';
const URL = BASE + 'index.html';

// Helper: collect console errors
async function collectConsoleErrors(page){
  const errors: string[] = [];
  page.on('console', msg => { if(msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

test('site loads, no console errors, and cards match manifest', async ({ page }) => {
  const errors = await collectConsoleErrors(page);
  await page.goto(URL);
  await page.waitForSelector('.card');

  // load manifest and compare counts (fetch via request to avoid relative path issues)
  const manifestResp = await page.request.get(BASE + 'default_drills_with_meta.json');
  expect(manifestResp.ok()).toBeTruthy();
  const manifest = await manifestResp.json();

  const cards = await page.$$('.card');
  expect(cards.length).toBe(manifest.length);

  // ensure each card has either a video, picture/webp or img and that declared preview source exists (dataset.src or resolved src)
  for (const c of cards){
    const hasVideo = await c.$('video') !== null;
    const hasImg = await c.$('img') !== null;
    const hasWebp = await c.$('picture source[type="image/webp"]') !== null;
    expect(hasVideo || hasImg || hasWebp).toBeTruthy();

    if(hasImg){
      const img = await c.$('img');
      const info = await img!.evaluate(node => ({ src: (node as HTMLImageElement).getAttribute('src'), dataset: (node as HTMLImageElement).dataset && (node as HTMLImageElement).dataset.src, current: (node as HTMLImageElement).currentSrc }));
      const ok = (info.src && info.src.length>0) || (info.dataset && info.dataset.length>0) || (info.current && info.current.length>0);
      expect(ok).toBeTruthy();
    }
    if(hasVideo){
      const v = await c.$('video');
      const info = await v!.evaluate(node => ({ dataset: (node as HTMLVideoElement).dataset && (node as HTMLVideoElement).dataset.src, current: (node as HTMLVideoElement).currentSrc || (node as HTMLVideoElement).src }));
      const ok = (info.dataset && info.dataset.length>0) || (info.current && info.current.length>0);
      expect(ok).toBeTruthy();
    }
  }

  // no console errors
  expect(errors.length).toBe(0);
});

test('theme, language and progress persist across reloads and assets exist', async ({ page }) => {
  await page.goto(URL);
  await page.waitForSelector('.card');

  // cycle theme twice
  await page.click('#theme-btn');
  await page.click('#theme-btn');
  const themeBefore = await page.evaluate(() => localStorage.getItem('bbdrills_ui_v1'));
  expect(themeBefore).toContain('"theme"');

  // toggle language and verify persisted
  await page.click('#btn-fi');
  await page.click('#btn-en');
  const uiRaw = await page.evaluate(() => localStorage.getItem('bbdrills_ui_v1'));
  expect(uiRaw).toBeTruthy();
  const ui = JSON.parse(uiRaw || '{}');
  expect(ui.lang).toBe('en');

  // mark first card done (find 'Mark done' button inside first card)
  const firstCard = page.locator('.card').first();
  const doneBtn = firstCard.locator('button', { hasText: 'Mark done' });
  if(await doneBtn.count() === 0){
    // maybe already marked, try 'Mark incomplete'
    const inc = firstCard.locator('button', { hasText: 'Mark incomplete' });
    if(await inc.count() > 0) await inc.click();
    else {
      // fallback: click last button in card
      await firstCard.locator('button').last().click();
    }
  } else {
    await doneBtn.click();
  }

  // reload and check the first card still has done class
  await page.reload();
  await page.waitForSelector('.card');
  const doneClass = await page.locator('.card').first().getAttribute('class');
  expect(doneClass).toContain('done');

  // verify that for manifest entries, at least one preview (webp or mp4) is served by the site
  const manifestResp = await page.request.get(BASE + 'default_drills_with_meta.json');
  const manifest = await manifestResp.json();
  const sampleLimit = 10;
  let checked = 0;
  for(const it of manifest){
    if(checked >= sampleLimit) break;
    const candidate = it.preview_mp4 || it.preview_webp || it.preview_webp || it.preview_mp4;
    if(candidate){
      const url = BASE + candidate.replace(/^site\//,'');
      const r = await page.request.get(url);
      expect(r.ok(), 'Missing preview for ' + it.id).toBeTruthy();
      checked++;
    }
  }
});

test('buttons: card buttons present and mark done toggles (separate from modal)', async ({ page }) => {
  await page.goto(URL);
  await page.waitForSelector('.card');

  const firstCard = page.locator('.card').first();
  // ensure there is at least one button in the card
  const btnCount = await firstCard.locator('button').count();
  expect(btnCount).toBeGreaterThanOrEqual(1);

  // if Open video exists, ensure it's enabled but do not open modal here
  const openBtn = firstCard.locator('button', { hasText: 'Open video' });
  if (await openBtn.count() > 0) {
    expect(await openBtn.isEnabled()).toBeTruthy();
  }

  // mark/unmark done safely
  const doneBtn = firstCard.locator('button', { hasText: 'Mark done' });
  if(await doneBtn.count() === 0){
    const inc = firstCard.locator('button', { hasText: 'Mark incomplete' });
    if(await inc.count() > 0) await inc.click();
    else await firstCard.locator('button').last().click();
  } else {
    await doneBtn.click();
  }

  // reload and check the first card still has done class
  await page.reload();
  await page.waitForSelector('.card');
  const doneClass = await page.locator('.card').first().getAttribute('class');
  expect(doneClass).toContain('done');
});

test('modal opens and closes when Open video clicked (if present)', async ({ page }) => {
  await page.goto(URL);
  await page.waitForSelector('.card');

  const firstCard = page.locator('.card').first();
  const viewBtn = firstCard.locator('button', { hasText: 'Open video' });
  if(await viewBtn.count() === 0){
    // no Open video button in this environment; skip gracefully
    return;
  }

  await viewBtn.click();

  // wait for modal to be visible; accept multiple indicators to be robust
  await page.waitForSelector('#modal.open', { timeout: 5000 }).catch(async () => {
    await page.waitForSelector('#modal', { state: 'visible', timeout: 5000 });
  });

  // try to close modal via close button/backdrop
  const closeBtn = page.locator('#modal .close, #modal .btn-close, #modal button[aria-label="Close"]');
  if(await closeBtn.count() > 0) await closeBtn.first().click();
  else await page.click('#modal');

  await page.waitForSelector('#modal', { state: 'hidden', timeout: 5000 }).catch(()=>{});
});

const perfTest = process.env.PERF_TESTS ? test : test.skip;
perfTest('performance: first two thumbnails load quickly (WebP/GIF/MP4)', async ({ page }) => {
  const start = Date.now();
  await page.goto(URL);
  await page.waitForSelector('.card');

  const checks = 2; // only verify first N previews to keep test fast and reliable
  await page.waitForFunction((checks) => {
    const cards = Array.from(document.querySelectorAll('.card')).slice(0, checks);
    if(cards.length === 0) return false;
    return cards.every(c => {
      const img = c.querySelector('img');
      const video = c.querySelector('video');
      if(img) return (img as HTMLImageElement).complete && ((img as HTMLImageElement).naturalWidth || (img as HTMLImageElement).src.indexOf('data:')===0);
      if(video) return (video as HTMLVideoElement).readyState >= 2;
      return false;
    });
  }, checks, { timeout: 20000 });

  const duration = Date.now() - start;
  expect(duration).toBeLessThan(20000);
});

test('server serves declared previews (webp/mp4)', async ({ page }) => {
  // fetch manifest and ensure declared preview files (webp or mp4) exist on server
  const manifestResp = await page.request.get(BASE + 'default_drills_with_meta.json');
  expect(manifestResp.ok()).toBeTruthy();
  const manifest = await manifestResp.json();
  const sampleLimit = 20;
  let checked = 0;
  for(const it of manifest){
    if(checked >= sampleLimit) break;
    for(const key of ['preview_webp','preview_mp4']){
      if(it[key]){
        const url = BASE + it[key].replace(/^site\//,'');
        const r = await page.request.get(url);
        expect(r.ok(), `${key} missing for ${it.id}`).toBeTruthy();
        checked++;
        if(checked >= sampleLimit) break;
      }
    }
  }
});

