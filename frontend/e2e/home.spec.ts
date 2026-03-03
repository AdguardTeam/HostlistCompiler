import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display dashboard title', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('Adblock Compiler Dashboard');
    });

    test('should show navigation cards', async ({ page }) => {
        const navCards = page.locator('.nav-card');
        await expect(navCards).toHaveCount(5);
    });

    test('should navigate to Compiler page', async ({ page }) => {
        await page.locator('.nav-card', { hasText: 'Filter List Compiler' }).click();
        await expect(page).toHaveURL(/\/compiler/);
        await expect(page.locator('h1')).toContainText('Compiler');
    });

    test('should show system status section', async ({ page }) => {
        // Scroll to trigger @defer (on viewport)
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await expect(page.locator('.status-card')).toBeVisible({ timeout: 10000 });
    });

    test('should display stat cards', async ({ page }) => {
        const statCards = page.locator('app-stat-card');
        // May show skeleton first, then real cards
        await expect(statCards.or(page.locator('app-skeleton-card'))).toHaveCount(4, { timeout: 10000 });
    });
});
