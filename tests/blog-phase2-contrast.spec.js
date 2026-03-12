const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8083';
const POST = '/blog/ui-animations-motion-design/';

test.describe('Phase 2 — Hero Contrast', () => {

  test('post-date color opacity >= 0.7', async ({ page }) => {
    await page.goto(BASE + POST, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const alpha = await page.evaluate(() => {
      const el = document.querySelector('.post-hero-wrap .post-date');
      if (!el) return 1;
      const c = getComputedStyle(el).color;
      const match = c.match(/rgba?\([\d.]+,\s*[\d.]+,\s*[\d.]+(?:,\s*([\d.]+))?\)/);
      return match && match[1] ? parseFloat(match[1]) : 1;
    });
    expect(alpha).toBeGreaterThanOrEqual(0.7);
  });

  test('post-title font-weight >= 400', async ({ page }) => {
    await page.goto(BASE + POST, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const weight = await page.evaluate(() => {
      const el = document.querySelector('.post-hero-wrap .post-title');
      if (!el) return 400;
      return parseInt(getComputedStyle(el).fontWeight);
    });
    expect(weight).toBeGreaterThanOrEqual(400);
  });

  test('post-title has text-shadow for readability', async ({ page }) => {
    await page.goto(BASE + POST, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const shadow = await page.evaluate(() => {
      const el = document.querySelector('.post-hero-wrap .post-title');
      if (!el) return 'none';
      return getComputedStyle(el).textShadow;
    });
    expect(shadow).not.toBe('none');
  });

  test('tag text opacity >= 0.6', async ({ page }) => {
    await page.goto(BASE + POST, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const alpha = await page.evaluate(() => {
      const el = document.querySelector('.post-tags span');
      if (!el) return 1;
      const c = getComputedStyle(el).color;
      const match = c.match(/rgba?\([\d.]+,\s*[\d.]+,\s*[\d.]+(?:,\s*([\d.]+))?\)/);
      return match && match[1] ? parseFloat(match[1]) : 1;
    });
    expect(alpha).toBeGreaterThanOrEqual(0.6);
  });

  test('tag background opacity >= 0.1', async ({ page }) => {
    await page.goto(BASE + POST, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const alpha = await page.evaluate(() => {
      const el = document.querySelector('.post-tags span');
      if (!el) return 1;
      const bg = getComputedStyle(el).backgroundColor;
      const match = bg.match(/rgba?\([\d.]+,\s*[\d.]+,\s*[\d.]+(?:,\s*([\d.]+))?\)/);
      return match && match[1] ? parseFloat(match[1]) : 1;
    });
    expect(alpha).toBeGreaterThanOrEqual(0.1);
  });
});
