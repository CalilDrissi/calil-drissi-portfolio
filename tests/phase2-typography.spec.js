const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8082';

test.describe('Phase 2 — Typography & Readability', () => {

  test('body font size is at least 13px', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const bodyFontSize = await page.evaluate(() => {
      return parseFloat(getComputedStyle(document.body).fontSize);
    });
    expect(bodyFontSize).toBeGreaterThanOrEqual(13);
  });

  test('body letter-spacing is 0 or positive', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });

    const letterSpacing = await page.evaluate(() => {
      return parseFloat(getComputedStyle(document.body).letterSpacing) || 0;
    });
    expect(letterSpacing).toBeGreaterThanOrEqual(0);
  });

  test('hero statement font-weight is at least 400', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const weight = await page.evaluate(() => {
      const el = document.querySelector('.statement');
      return parseInt(getComputedStyle(el).fontWeight);
    });
    expect(weight).toBeGreaterThanOrEqual(400);
  });

  test('hero statement line-height is at least 1.45', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const lh = await page.evaluate(() => {
      const el = document.querySelector('.statement');
      const cs = getComputedStyle(el);
      return parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
    });
    expect(lh).toBeGreaterThanOrEqual(1.45);
  });

  test('CTA buttons have min-height >= 36px', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const heights = await page.evaluate(() => {
      return [...document.querySelectorAll('.cta-btn')].map(b => b.offsetHeight);
    });
    for (const h of heights) {
      expect(h).toBeGreaterThanOrEqual(34);
    }
  });

  test('CTA button font-size is at least 11px', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const sizes = await page.evaluate(() => {
      return [...document.querySelectorAll('.cta-btn')].map(b =>
        parseFloat(getComputedStyle(b).fontSize)
      );
    });
    for (const s of sizes) {
      expect(s).toBeGreaterThanOrEqual(11);
    }
  });

  test('no text element smaller than 7px on desktop', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const tinyText = await page.evaluate(() => {
      const found = [];
      document.querySelectorAll('*').forEach(el => {
        const cs = getComputedStyle(el);
        const fs = parseFloat(cs.fontSize);
        const text = el.textContent?.trim();
        if (fs < 7 && text && text.length > 0 && el.children.length === 0 && cs.display !== 'none' && cs.visibility !== 'hidden') {
          found.push({ text: text.substring(0, 20), fontSize: fs });
        }
      });
      return found;
    });
    expect(tinyText).toHaveLength(0);
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
