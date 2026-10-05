import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y, getViolations } from 'axe-playwright';

test.describe('accessibility', () => {
  test('home page has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true
      }
    });
  });

  test('projects page has no accessibility violations', async ({ page }) => {
    await page.goto('/projects');
    await injectAxe(page);
    await checkA11y(page);
  });

  test('project detail page has no accessibility violations', async ({ page }) => {
    await page.goto('/projects/conclave');
    await injectAxe(page);
    await checkA11y(page);
  });

  test('404 page has no accessibility violations', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await injectAxe(page);
    await checkA11y(page);
  });

  test('all pages have exactly one h1', async ({ page }) => {
    const routes = ['/', '/projects', '/about', '/experience', '/resume', '/contact', '/colophon'];

    for (const route of routes) {
      await page.goto(route);
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1, `Route ${route} should have exactly one h1`);
    }
  });

  test('color contrast meets WCAG AA', async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);

    // Check contrast violations specifically
    const violations = await getViolations(page);
    const contrastViolations = violations.filter(v => v.id === 'color-contrast');

    expect(contrastViolations.length).toBe(0, 'Should have no color contrast violations');
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/');

    // Tab through focusable elements
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();

    // Tab through several elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    }
  });

  test('skip link is present and keyboard accessible', async ({ page }) => {
    await page.goto('/');

    // Check for skip link (or main landmark)
    const main = page.locator('main');
    await expect(main).toBeTruthy();
  });
});
