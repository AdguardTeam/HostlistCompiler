import { test, expect } from '@playwright/test';

test.describe('Compiler Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/compiler');
    });

    test('should display compiler form', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('Compiler');
        await expect(page.locator('form')).toBeVisible();
    });

    test('should have preset selector', async ({ page }) => {
        await expect(page.locator('mat-select')).toBeVisible();
    });

    test('should have at least one URL input', async ({ page }) => {
        const urlInputs = page.locator('input[type="url"]');
        await expect(urlInputs.first()).toBeVisible();
    });

    test('should add and remove URL inputs', async ({ page }) => {
        const addButton = page.locator('button', { hasText: 'Add URL' });
        await addButton.click();
        const urlInputs = page.locator('input[type="url"]');
        const count = await urlInputs.count();
        expect(count).toBeGreaterThanOrEqual(2);
    });

    test('should toggle SSE streaming mode', async ({ page }) => {
        const toggle = page.locator('mat-slide-toggle');
        await expect(toggle).toBeVisible();
        await toggle.click();
    });

    test('should show resource status card', async ({ page }) => {
        await expect(page.locator('.resource-status-card')).toBeVisible();
    });
});
