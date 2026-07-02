import { test, expect } from '@playwright/test';
import { gotoApp, positiveBtn, negativeBtn, statValue, dayCell, TODAY, YESTERDAY } from './helpers';

test.describe('stats', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('current streak counts consecutive completed days ending today', async ({ page }) => {
    await positiveBtn(page).click();
    await expect(statValue(page, 'Current Streak')).toHaveText('1');

    // Also complete yesterday -> streak of 2.
    await dayCell(page, YESTERDAY).click();
    await expect(page.getByRole('heading', { name: /June 15/ })).toBeVisible();
    await positiveBtn(page).click();
    await expect(statValue(page, 'Current Streak')).toHaveText('2');
  });

  test('a failed today breaks the streak but keeps earlier completions in the rate', async ({ page }) => {
    // Yesterday completed...
    await dayCell(page, YESTERDAY).click();
    await positiveBtn(page).click();

    // ...today failed.
    await dayCell(page, TODAY).click();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await negativeBtn(page).click();

    await expect(statValue(page, 'Current Streak')).toHaveText('0');
    // 1 completed of 2 tracked days.
    await expect(statValue(page, 'Success Rate')).toHaveText('50%');
  });
});
