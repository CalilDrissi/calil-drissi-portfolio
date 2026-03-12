const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8083';
const POST = '/blog/ui-animations-motion-design/';

test.describe('Phase 3 — Post Nav Responsive', () => {

  test('post-nav links stack vertically at 480px', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 480, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(BASE + POST, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const layout = await page.evaluate(() => {
      const links = document.querySelectorAll('.post-nav-link');
      if (links.length < 2) return { stacked: true };
      const r1 = links[0].getBoundingClientRect();
      const r2 = links[1].getBoundingClientRect();
      return {
        stacked: r2.top > r1.bottom - 5,
        link1Bottom: r1.bottom,
        link2Top: r2.top,
        link1Width: r1.width,
        viewportWidth: window.innerWidth
      };
    });

    expect(layout.stacked).toBe(true);
    await ctx.close();
  });

  test('post-nav titles not truncated beyond recognition at 768px', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 768, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + POST, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const titles = await page.evaluate(() => {
      return [...document.querySelectorAll('.post-nav-title')].map(t => ({
        text: t.textContent,
        width: t.offsetWidth,
        truncated: t.scrollWidth > t.clientWidth
      }));
    });

    for (const t of titles) {
      expect(t.width).toBeGreaterThan(80);
    }
    await ctx.close();
  });

  test('post-nav center grid visible at all sizes', async ({ browser }) => {
    for (const w of [480, 768, 1024, 1440]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + POST, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      const grid = await page.locator('.post-nav-grid').boundingBox();
      expect(grid).not.toBeNull();
      if (grid) {
        expect(grid.width).toBeGreaterThan(10);
        expect(grid.height).toBeGreaterThan(10);
      }
      await ctx.close();
    }
  });
});
