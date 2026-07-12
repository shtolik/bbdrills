const playwright = require('playwright');
(async () => {
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE CONSOLE', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR', err.stack || err));
  page.on('requestfailed', req => console.log('REQ FAIL', req.url(), req.failure() && req.failure().errorText));
  await page.goto('http://127.0.0.1:8000/site/index.html');
  console.log('Loaded, waiting 2s');
  await page.waitForTimeout(2000);
  const html = await page.content();
  console.log('PAGE HTML SNIPPET:\n', html.slice(0,2000));
  await browser.close();
})();
