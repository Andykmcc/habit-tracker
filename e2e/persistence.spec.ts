import { test, expect } from '@playwright/test';
import { gotoApp, positiveBtn, noteBox, statValue, dayCircle, habitName, TODAY } from './helpers';

test.describe('persistence', () => {
  test('data survives a page reload', async ({ page }) => {
    await gotoApp(page);

    await positiveBtn(page).click();
    await noteBox(page).fill('kept across reload');
    await expect(statValue(page, 'Success Rate')).toHaveText('100%');

    await page.reload();

    await expect(habitName(page)).toHaveValue('Daily Habit');
    await expect(statValue(page, 'Success Rate')).toHaveText('100%');
    await expect(dayCircle(page, TODAY)).toHaveClass(/bg-cyan-500/);
    await expect(noteBox(page)).toHaveValue('kept across reload');
  });
});
