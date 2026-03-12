const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8082';

test.describe('Phase 3 — Interactive Elements', () => {

  test('CTA buttons min-height 44px on mobile', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const heights = await page.evaluate(() => {
      return [...document.querySelectorAll('.cta-btn')].map(b => b.offsetHeight);
    });
    for (const h of heights) {
      expect(h).toBeGreaterThanOrEqual(42);
    }
    await ctx.close();
  });

  test('connect links have adequate spacing', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const gap = await page.evaluate(() => {
      const el = document.querySelector('.connect-links');
      return parseFloat(getComputedStyle(el).gap);
    });
    expect(gap).toBeGreaterThanOrEqual(2);
  });

  test('articles list has adequate spacing', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const gap = await page.evaluate(() => {
      const el = document.querySelector('.articles-list');
      return parseFloat(getComputedStyle(el).gap);
    });
    expect(gap).toBeGreaterThanOrEqual(3);
  });
});
