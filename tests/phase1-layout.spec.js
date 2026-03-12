const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8082';

test.describe('Phase 1 — Responsive Layout', () => {

  test('content is not clipped at 1366x768', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const bottom = await page.locator('.bottom').boundingBox();
    expect(bottom).not.toBeNull();
    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflowY);
    const pageHeight = await page.evaluate(() => document.querySelector('.page').scrollHeight);
    const viewportH = 768;

    if (pageHeight > viewportH) {
      expect(['auto', 'scroll', 'visible']).toContain(bodyOverflow);
    } else {
      expect(bottom.y + bottom.height).toBeLessThanOrEqual(viewportH + 50);
    }
    await ctx.close();
  });

  test('content is not clipped at 1280x800', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const bottom = await page.locator('.bottom').boundingBox();
    expect(bottom).not.toBeNull();
    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflowY);
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    if (bodyHeight > 800) {
      expect(['auto', 'scroll', 'visible']).toContain(bodyOverflow);
    }
    await ctx.close();
  });

  test('hero text .middle has minimum height protection', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 600 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const middle = await page.locator('.middle').boundingBox();
    expect(middle).not.toBeNull();
    expect(middle.height).toBeGreaterThan(100);
    await ctx.close();
  });

  test('1024x768 still scrollable (existing tablet breakpoint)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(bodyOverflow).toBe('auto');
    await ctx.close();
  });

  test('1440x900 layout looks correct (tall desktop)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflowY);
    expect(['hidden', 'auto', 'scroll']).toContain(bodyOverflow);

    for (const sel of ['.top-grid', '.middle', '.bottom']) {
      const box = await page.locator(sel).boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThan(50);
    }
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
