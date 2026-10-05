import { test, expect } from '@playwright/test';

test.describe('smoke tests', () => {
  test('home page loads and has h1', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    expect(await h1.count()).toBe(1);
  });

  test('navigation links are accessible', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('404 page is accessible', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    expect(page.url()).toContain('404');
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/');
    const firstLink = page.locator('a').first();
    await firstLink.focus();
    const isFocused = await firstLink.evaluate((el) =>
      el === document.activeElement
    );
    expect(isFocused).toBe(true);
  });

  test('resume.json is served and parses', async ({ request }) => {
    const res = await request.get('/resume.json');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.basics.name).toBeTruthy();
  });

  test('home page includes Person JSON-LD', async ({ page }) => {
    await page.goto('/');
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    const data = JSON.parse(ld || '{}');
    expect(data['@type']).toBe('Person');
  });
});
