const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const host = 'https://optiplex-homeserver.tail920911.ts.net';
const pages = { photos: `${host}/`, drive: `${host}/drive/`, cockpit: `${host}:10000/` };

(async () => {
  const server = http.createServer((req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname.split('/')[1];
    if (!Object.hasOwn(pages, name)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(root, name, 'index.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
    for (const javascriptEnabled of [false, true]) {
      const context = await browser.newContext({ javaScriptEnabled: javascriptEnabled });
      for (const [name, destination] of Object.entries(pages)) {
        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}/${name}/?next=https://example.com/#ignored`);
        const title = name[0].toUpperCase() + name.slice(1);
        assert.equal(await page.title(), `${title} shortcut`);
        assert.equal(await page.locator('html').getAttribute('lang'), 'en');
        assert.equal(await page.getByRole('main').getByRole('heading', { name: title, level: 1 }).count(), 1);
        assert.match(await page.locator('main').innerText(), /may need to connect to Tailscale.*account that has access/i);
        assert.match(await page.locator('main').innerText(), /may also require a separate sign-in/i);
        assert.equal(await page.locator('meta[http-equiv="refresh" i]').count(), 0);
        const link = page.getByRole('link', { name: `Open ${title}` });
        assert.equal(await link.count(), 1);
        assert.equal(await link.getAttribute('href'), destination);
        await page.route('**/*', route => route.abort());
        const request = page.waitForRequest(req => req.isNavigationRequest());
        await page.keyboard.press('Tab');
        assert.equal(await link.evaluate(el => el === document.activeElement), true);
        await page.keyboard.press('Enter');
        assert.equal((await request).url(), destination);
        await page.close();
      }
      await context.close();
    }
    assert.equal(fs.readFileSync(path.join(root, 'CNAME'), 'utf8').trim(), 'sol.run.place');
    console.log('Passed: three exact destinations, keyboard navigation, accessible fallback, query handling, with and without JavaScript, and custom domain.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
