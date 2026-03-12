const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8083';
const POSTS = [
  '/blog/ui-animations-motion-design/',
  '/blog/error-handling-patterns/',
  '/blog/cloudflare-workers-edge-computing/',
];

const VIEWPORTS = [
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Laptop', width: 1366, height: 768 },
  { name: 'TOC-edge', width: 1100, height: 900 },
  { name: 'Tablet', width: 1024, height: 768 },
  { name: 'Below-TOC', width: 900, height: 768 },
  { name: 'Tablet-portrait', width: 768, height: 1024 },
  { name: 'Mobile', width: 480, height: 844 },
  { name: 'Mobile-small', width: 375, height: 667 },
];

for (const vp of VIEWPORTS) {
  test.describe(`Blog @ ${vp.name} (${vp.width}x${vp.height})`, () => {

    test(`page loads without JS errors — ${POSTS[0]}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));
      await page.goto(BASE + POSTS[0], { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      expect(errors).toHaveLength(0);
      await ctx.close();
    });

    if (vp.width > 900) {
      test('TOC active item collapses after peek', async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await ctx.newPage();
        await page.goto(BASE + POSTS[0], { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollTo(0, 800));
        await page.waitForTimeout(4000);

        const hasPeek = await page.evaluate(() => {
          const active = document.querySelector('.toc-item.active');
          return active ? active.classList.contains('peek') : false;
        });
        expect(hasPeek).toBe(false);
        await ctx.close();
      });
    }

    if (vp.width <= 900) {
      test('TOC is hidden', async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await ctx.newPage();
        await page.goto(BASE + POSTS[0], { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        const display = await page.evaluate(() => {
          const toc = document.querySelector('.toc');
          return toc ? getComputedStyle(toc).display : 'none';
        });
        expect(display).toBe('none');
        await ctx.close();
      });
    }

    test('takes screenshot', async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(BASE + POSTS[0], { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      await page.screenshot({
        path: `tests/screenshots/blog-${vp.name}-${vp.width}x${vp.height}.png`,
        fullPage: false
      });
      await ctx.close();
    });
  });
}
