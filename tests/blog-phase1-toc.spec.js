const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8083';
const POST = '/blog/ui-animations-motion-design/';

test.describe('Phase 1 — TOC Label Behavior', () => {

  test('active TOC item does NOT show label by default', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + POST, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(1000);

    const labelMaxWidth = await page.evaluate(() => {
      const active = document.querySelector('.toc-item.active .toc-label');
      if (!active) return 'no-active';
      return getComputedStyle(active).maxWidth;
    });

    expect(labelMaxWidth).toBe('0px');
    await ctx.close();
  });

  test('TOC label expands on hover', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + POST, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(1000);

    const tocNum = await page.locator('.toc-item:first-child .toc-num');
    if (await tocNum.count() > 0) {
      await tocNum.hover();
      await page.waitForTimeout(600);

      const labelWidth = await page.evaluate(() => {
        const label = document.querySelector('.toc-item:first-child .toc-label');
        if (!label) return 0;
        return label.offsetWidth;
      });
      expect(labelWidth).toBeGreaterThan(10);
    }
    await ctx.close();
  });

  test('TOC label does not overlap article content at 1100px', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + POST, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(1000);

    const overlap = await page.evaluate(() => {
      const active = document.querySelector('.toc-item.active');
      if (!active) return { overlap: false, reason: 'no active item', labelWidth: 0 };
      const label = active.querySelector('.toc-label');
      const labelRect = label.getBoundingClientRect();
      const container = document.querySelector('.post-container') || document.querySelector('.post-body');
      if (!container) return { overlap: false, reason: 'no container', labelWidth: 0 };
      const containerRect = container.getBoundingClientRect();

      return {
        overlap: labelRect.right > containerRect.left && labelRect.width > 0,
        labelRight: labelRect.right,
        labelWidth: labelRect.width,
        containerLeft: containerRect.left
      };
    });

    expect(overlap.labelWidth).toBeLessThanOrEqual(1);
    await ctx.close();
  });
});
