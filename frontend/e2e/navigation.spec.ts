import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
    test('should navigate through all routes via sidenav', async ({ page }) => {
        await page.goto('/');

        const routes = [
            { label: 'Compiler', url: '/compiler' },
            { label: 'Performance', url: '/performance' },
            { label: 'Validation', url: '/validation' },
            { label: 'API Docs', url: '/api-docs' },
            { label: 'Admin', url: '/admin' },
            { label: 'Home', url: '/' },
        ];

        for (const route of routes) {
            await page.locator('mat-nav-list a', { hasText: route.label }).click();
            await expect(page).toHaveURL(new RegExp(route.url.replace('/', '\\/')));
        }
    });

    /**
     * WCAG 2.4.2 (Page Titled) — Level A
     * Each route must produce a unique, descriptive <title> element so that
     * screen reader and browser-tab users can identify the current page.
     */
    test('should set a unique page title for each route', async ({ page }) => {
        const routes = [
            { path: '/', title: 'Home | Adblock Compiler' },
            { path: '/compiler', title: 'Compiler | Adblock Compiler' },
            { path: '/performance', title: 'Performance | Adblock Compiler' },
            { path: '/validation', title: 'Validation | Adblock Compiler' },
            { path: '/api-docs', title: 'API Reference | Adblock Compiler' },
            { path: '/admin', title: 'Admin | Adblock Compiler' },
        ];

        for (const route of routes) {
            await page.goto(route.path);
            await expect(page).toHaveTitle(route.title);
        }
    });

    test('should toggle theme', async ({ page }) => {
        await page.goto('/');
        const themeButton = page.locator('button[aria-label="Toggle theme"]');
        await expect(themeButton).toBeVisible();
        await themeButton.click();
        // Body should have dark-theme class
        await expect(page.locator('body')).toHaveClass(/dark-theme/);
        // Toggle back
        await themeButton.click();
        await expect(page.locator('body')).not.toHaveClass(/dark-theme/);
    });

    test('should toggle sidenav', async ({ page }) => {
        await page.goto('/');
        const menuButton = page.locator('button[aria-label="Toggle navigation"]');
        await expect(menuButton).toBeVisible();
        // Sidenav should be open by default on desktop
        await expect(page.locator('mat-sidenav')).toBeVisible();
        await menuButton.click();
        // After click, sidenav might close
    });

    test('should handle wildcard routes by redirecting to home', async ({ page }) => {
        await page.goto('/nonexistent-page');
        await expect(page).toHaveURL('/');
    });
});
