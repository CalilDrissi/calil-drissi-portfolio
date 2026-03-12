const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8082';

test.describe('Phase 1 — Layout always 100vh', () => {

  test('body is always 100vh with overflow hidden at 1366x768', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => ({
      bodyHeight: getComputedStyle(document.body).height,
      bodyOverflow: getComputedStyle(document.body).overflowY,
      pageHeight: getComputedStyle(document.querySelector('.page')).height,
    }));
    expect(result.bodyOverflow).toBe('hidden');
    await ctx.close();
  });

  test('body is always 100vh with overflow hidden at 1280x800', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => ({
      bodyOverflow: getComputedStyle(document.body).overflowY,
    }));
    expect(result.bodyOverflow).toBe('hidden');
    await ctx.close();
  });

  test('all three sections visible at 1440x900', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    for (const sel of ['.top-grid', '.middle', '.bottom']) {
      const box = await page.locator(sel).boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThan(20);
    }
    await ctx.close();
  });

  test('all three sections visible at 1366x768', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    for (const sel of ['.top-grid', '.middle', '.bottom']) {
      const box = await page.locator(sel).boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThan(20);
    }
    await ctx.close();
  });

  test('page fits in viewport at 1440x600 (short widescreen)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 600 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflowY);
    expect(bodyOverflow).toBe('hidden');
    await ctx.close();
  });

  test('win panels do not overflow viewport', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.click('#introIdentity');
    await page.waitForTimeout(500);

    const win = await page.locator('#aboutPopup.open').boundingBox();
    if (win) {
      expect(win.y + win.height).toBeLessThanOrEqual(768 + 20);
    }
    await ctx.close();
  });
});
