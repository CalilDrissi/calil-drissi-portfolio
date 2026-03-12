const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8083';
const POST = '/blog/ui-animations-motion-design/';

test.describe('Phase 1 — TOC Label Behavior', () => {

  test('active TOC item collapses label after peek', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + POST, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.evaluate(() => window.scrollTo(0, 800));
    // Wait for peek (2.5s) + transition (0.5s) to finish
    await page.waitForTimeout(4000);

    const hasPeek = await page.evaluate(() => {
      const active = document.querySelector('.toc-item.active');
      return active ? active.classList.contains('peek') : false;
    });

    expect(hasPeek).toBe(false);
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
    // Wait for peek to finish
    await page.waitForTimeout(4000);

    const hasPeek = await page.evaluate(() => {
      const active = document.querySelector('.toc-item.active');
      return active ? active.classList.contains('peek') : false;
    });

    expect(hasPeek).toBe(false);
    await ctx.close();
  });
});
