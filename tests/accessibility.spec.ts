import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const syncedProjects = JSON.parse(
  readFileSync(resolve('src/content/synced/projects.json'), 'utf-8')
) as { public_slug?: string }[];

test.describe('accessibility', () => {
  test('home page has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('projects page has no accessibility violations', async ({ page }) => {
    await page.goto('/projects');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('project detail page has no accessibility violations', async ({ page }) => {
    // Use the first published project so this does not depend on a specific slug.
    const slug = syncedProjects.find(p => p.public_slug)?.public_slug;
    await page.goto(slug ? `/projects/${slug}` : '/projects');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('404 page has no accessibility violations', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('all pages have exactly one h1', async ({ page }) => {
    const routes = ['/', '/projects', '/about', '/experience', '/resume', '/contact', '/colophon'];

    for (const route of routes) {
      await page.goto(route);
      const h1Count = await page.locator('h1').count();
      expect(h1Count, `Route ${route} should have exactly one h1`).toBe(1);
    }
  });

  test('color contrast meets WCAG AA', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();
    const contrastViolations = results.violations.filter(v => v.id === 'color-contrast');
    expect(contrastViolations.length, 'Should have no color contrast violations').toBe(0);
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/');

    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    }
  });

  test('main landmark is present', async ({ page }) => {
    await page.goto('/');
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });
});
