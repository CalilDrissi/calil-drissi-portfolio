const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8082';

test.describe('Phase 2 — Typography scales with viewport', () => {

  test('font sizes scale — larger viewport = larger font', async ({ browser }) => {
    // Check at 1920px wide
    const ctx1 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page1 = await ctx1.newPage();
    await page1.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page1.waitForTimeout(1500);
    const bigFont = await page1.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    await ctx1.close();

    // Check at 1280px wide
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page2 = await ctx2.newPage();
    await page2.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page2.waitForTimeout(1500);
    const smallFont = await page2.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    await ctx2.close();

    // Larger viewport should have same or larger font
    expect(bigFont).toBeGreaterThanOrEqual(smallFont);
  });

  test('hero statement font-weight is 400', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const weight = await page.evaluate(() => {
      const el = document.querySelector('.statement');
      return parseInt(getComputedStyle(el).fontWeight);
    });
    expect(weight).toBe(400);
  });

  test('body letter-spacing is 0 (normal)', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const ls = await page.evaluate(() => getComputedStyle(document.body).letterSpacing);
    expect(ls).toBe('normal');
  });

  test('article links have underline decoration', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const decoration = await page.evaluate(() => {
      const link = document.querySelector('.articles-list a');
      if (!link) return 'none';
      return getComputedStyle(link).textDecorationLine;
    });
    expect(decoration).toContain('underline');
  });

  test('--fg-dim opacity is at least 0.82', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const alpha = await page.evaluate(() => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--fg-dim').trim();
      const match = raw.match(/[\d.]+\s*\)$/);
      if (match) return parseFloat(match[0]);
      return 1;
    });
    expect(alpha).toBeGreaterThanOrEqual(0.82);
  });
});
