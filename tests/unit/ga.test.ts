import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

const INDEX_PATH = path.resolve(__dirname, '../../site/index.html');
const html = fs.readFileSync(INDEX_PATH, 'utf8');

function runDom(htmlString: string) {
  // run inline scripts so the GA bootstrap executes
  const dom = new JSDOM(htmlString, { runScripts: 'dangerously', resources: 'usable' });
  return new Promise<JSDOM>((resolve) => {
    // allow inline scripts to synchronously run
    setTimeout(() => resolve(dom), 50);
  });
}

describe('GA placeholder injection', () => {
  it('does not load gtag when placeholder is present', async () => {
    const placeholderHtml = html.replace(/<meta name="ga-measurement-id" content="[^"]*"\s*\/>/, '<meta name="ga-measurement-id" content="__GA_MEASUREMENT_ID__" />');
    const dom = await runDom(placeholderHtml);
    const scripts = Array.from(dom.window.document.getElementsByTagName('script'));
    const gtagScript = scripts.find(s => s.src && s.src.includes('googletagmanager.com'));
    expect(gtagScript).toBeUndefined();
  });

  it('inserts gtag script when a valid GA4 id is present', async () => {
    const testId = 'G-TEST12345';
    const withIdHtml = html.replace(/<meta name="ga-measurement-id" content="[^"]*"\s*\/>/, `<meta name="ga-measurement-id" content="${testId}" />`);
    const dom = await runDom(withIdHtml);
    const scripts = Array.from(dom.window.document.getElementsByTagName('script')) as HTMLScriptElement[];
    const gtagScript = scripts.find(s => s.src && s.src.includes('gtag/js?id=' + testId));
    expect(gtagScript).toBeTruthy();
  });
});
