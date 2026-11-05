import { test, expect } from '@playwright/test';

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1365, height: 900 },
];

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content, `horizontal overflow: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test.describe('responsive login', () => {
  for (const viewport of viewports) {
    test(`login page fits ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/login');
      await expect(page.locator('input').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const firstField = page.locator('input').first();
      await firstField.focus();
      await expect(firstField).toBeFocused();
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe('authenticated Student/Admin/Chat responsive smoke', () => {
  const hasStorageState = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE);
  const routes = (process.env.PLAYWRIGHT_QA_ROUTES || '/students?view=dashboard,/chat,/settings')
    .split(',').map(route => route.trim()).filter(Boolean);

  for (const route of routes) {
    for (const viewport of viewports) {
      test(`${route} fits ${viewport.width}px`, async ({ page }) => {
        test.skip(!hasStorageState, 'Set PLAYWRIGHT_STORAGE_STATE to a valid authenticated browser state.');
        await page.setViewportSize(viewport);
        await page.goto(route);
        await expect(page.locator('body')).toBeVisible();
        await expectNoHorizontalOverflow(page);

        // Focus the first available editable control to catch common mobile
        // keyboard/layout shifts. Real iOS/Android virtual keyboards still need
        // device-level QA; Playwright desktop emulation cannot fully reproduce them.
        const editable = page.locator('textarea:visible, input:visible').first();
        if (await editable.count()) {
          await editable.focus();
          await expectNoHorizontalOverflow(page);
        }
      });
    }
  }
});
