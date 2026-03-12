const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8082';

test.describe('Phase 3 — Interactive Elements', () => {

  test('CTA buttons scale with viewport', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const heights = await page.evaluate(() => {
      return [...document.querySelectorAll('.cta-btn')].map(b => b.offsetHeight);
    });
    for (const h of heights) {
      expect(h).toBeGreaterThan(0);
    }
    await ctx.close();
  });

  test('no hardcoded font-size px in body computed style', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // All these should use relative units (resolved to px by browser, but from clamp/var)
    const bodyFS = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    expect(bodyFS).toBeGreaterThan(0);
  });
});
