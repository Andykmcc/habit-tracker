import { test, expect } from '@playwright/test';
import { gotoApp, positiveBtn, dayCell, dayCircle, TODAY } from './helpers';

test.describe('calendar', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('highlights today', async ({ page }) => {
    await expect(dayCircle(page, TODAY)).toHaveClass(/ring-blue-500/);
  });

  test('reflects a completed day with the positive color', async ({ page }) => {
    await positiveBtn(page).click();
    await expect(dayCircle(page, TODAY)).toHaveClass(/bg-cyan-500/);
  });

  test('does not allow selecting a future day', async ({ page }) => {
    const future = dayCell(page, '2025-06-20');
    await expect(future).toHaveClass(/cursor-default/);
    await future.click(); // no-op: future days are not clickable
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  });

  test('navigates between months', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'June 2025' })).toBeVisible();

    await page.getByRole('button', { name: '→' }).click();
    await expect(page.getByRole('heading', { name: 'July 2025' })).toBeVisible();

    await page.getByRole('button', { name: '←' }).click();
    await page.getByRole('button', { name: '←' }).click();
    await expect(page.getByRole('heading', { name: 'May 2025' })).toBeVisible();
  });
});
