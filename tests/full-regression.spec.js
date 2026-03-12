const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8082';

const VIEWPORTS = [
  { name: '4K', width: 2560, height: 1440 },
  { name: 'Desktop', width: 1920, height: 1080 },
  { name: 'MacBook Pro', width: 1440, height: 900 },
  { name: 'Laptop HD', width: 1366, height: 768 },
  { name: 'Laptop Small', width: 1280, height: 800 },
  { name: 'Short Widescreen', width: 1366, height: 600 },
  { name: 'Tablet', width: 1024, height: 768 },
  { name: 'Tablet Portrait', width: 768, height: 1024 },
  { name: 'Mobile Large', width: 428, height: 926 },
  { name: 'Mobile', width: 390, height: 844 },
  { name: 'Mobile Small', width: 375, height: 667 },
];

for (const vp of VIEWPORTS) {
  test.describe(`Regression @ ${vp.name} (${vp.width}x${vp.height})`, () => {

    test('page loads without JS errors', async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      expect(errors).toHaveLength(0);
      await ctx.close();
    });

    test('no content clipped — all sections visible or scrollable', async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);

      const result = await page.evaluate(() => {
        const body = document.body;
        const bodyCS = getComputedStyle(body);
        const bodyScrollH = body.scrollHeight;
        const viewH = window.innerHeight;
        const canScroll = bodyCS.overflowY === 'auto' || bodyCS.overflowY === 'scroll' || bodyCS.overflowY === 'visible';

        const overflows = bodyScrollH > viewH + 10;
        return { canScroll, overflows, bodyScrollH, viewH, bodyOverflow: bodyCS.overflowY };
      });

      if (result.overflows) {
        expect(result.canScroll).toBe(true);
      }
      await ctx.close();
    });

    test('body font size >= 12px', async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      const fs = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
      expect(fs).toBeGreaterThanOrEqual(12);
      await ctx.close();
    });

    test('takes screenshot', async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);

      await page.screenshot({
        path: `tests/screenshots/${vp.name.replace(/\s/g, '-')}-${vp.width}x${vp.height}.png`,
        fullPage: false
      });
      await ctx.close();
    });
  });
}
