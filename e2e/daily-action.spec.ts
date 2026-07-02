import { test, expect } from '@playwright/test';
import { gotoApp, positiveBtn, negativeBtn, noteBox, statValue, TODAY } from './helpers';

test.describe('daily action', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('marks today completed, then clears it on a second click', async ({ page }) => {
    await expect(statValue(page, 'Success Rate')).toHaveText('0%');

    await positiveBtn(page).click();
    await expect(positiveBtn(page)).toHaveClass(/bg-cyan-500/);
    await expect(statValue(page, 'Success Rate')).toHaveText('100%');
    await expect(page.locator('.all-time-rate')).toHaveText('100%');

    // Clicking the active status again clears it back to untracked.
    await positiveBtn(page).click();
    await expect(positiveBtn(page)).not.toHaveClass(/bg-cyan-500/);
    await expect(statValue(page, 'Success Rate')).toHaveText('0%');
  });

  test('marking negative counts as tracked but not completed', async ({ page }) => {
    await negativeBtn(page).click();
    await expect(negativeBtn(page)).toHaveClass(/bg-red-500/);
    await expect(statValue(page, 'Success Rate')).toHaveText('0%');
    await expect(statValue(page, 'Current Streak')).toHaveText('0');
  });

  test('flips a day from completed to failed', async ({ page }) => {
    await positiveBtn(page).click();
    await expect(statValue(page, 'Success Rate')).toHaveText('100%');

    await negativeBtn(page).click();
    await expect(negativeBtn(page)).toHaveClass(/bg-red-500/);
    await expect(positiveBtn(page)).not.toHaveClass(/bg-cyan-500/);
    await expect(statValue(page, 'Success Rate')).toHaveText('0%');
  });

  test('saves a note and shows the calendar note indicator', async ({ page }) => {
    await noteBox(page).fill('Felt great today');
    await expect(noteBox(page)).toHaveValue('Felt great today');
    await expect(page.locator(`[data-date="${TODAY}"] .bg-blue-400`)).toBeVisible();
  });
});
