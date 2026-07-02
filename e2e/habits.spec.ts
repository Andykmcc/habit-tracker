import { test, expect } from '@playwright/test';
import { gotoApp, positiveBtn, negativeBtn, statValue, habitName, openHabitMenu } from './helpers';

const createHabit = async (page: import('@playwright/test').Page, name: string) => {
  await openHabitMenu(page);
  await page.locator('.habit-selector-new-btn').click();
  await page.locator('.habit-selector-new-input').fill(name);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(habitName(page)).toHaveValue(name);
};

test.describe('habits', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('creates a new habit and makes it active', async ({ page }) => {
    await createHabit(page, 'Reading');

    await openHabitMenu(page);
    await expect(page.locator('.habit-selector-item')).toHaveCount(2);
  });

  test('keeps each habit\'s logs separate', async ({ page }) => {
    // Complete today on the default habit.
    await positiveBtn(page).click();
    await expect(statValue(page, 'Success Rate')).toHaveText('100%');

    // A brand-new habit starts empty.
    await createHabit(page, 'Meditation');
    await expect(statValue(page, 'Success Rate')).toHaveText('0%');
    await expect(positiveBtn(page)).not.toHaveClass(/bg-cyan-500/);

    // Switching back restores the original habit's data.
    await openHabitMenu(page);
    await page.locator('.habit-selector-item', { hasText: 'Daily Habit' }).click();
    await expect(habitName(page)).toHaveValue('Daily Habit');
    await expect(statValue(page, 'Success Rate')).toHaveText('100%');
  });

  test('deletes a habit after confirmation', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await createHabit(page, 'Reading');

    await openHabitMenu(page);
    await expect(page.locator('.habit-selector-item')).toHaveCount(2);

    await page
      .locator('.habit-selector-item', { hasText: 'Daily Habit' })
      .locator('.habit-selector-delete')
      .click();

    await expect(page.locator('.habit-selector-item')).toHaveCount(1);
    await expect(habitName(page)).toHaveValue('Reading');
  });

  test('offers no delete control for the last remaining habit', async ({ page }) => {
    await openHabitMenu(page);
    await expect(page.locator('.habit-selector-item')).toHaveCount(1);
    await expect(page.locator('.habit-selector-delete')).toHaveCount(0);
  });

  test('applies custom labels to the daily action buttons', async ({ page }) => {
    await openHabitMenu(page);
    await page.getByPlaceholder('✕').fill('N');
    await page.getByPlaceholder('✓').fill('Y');

    // Labels apply live; the menu overlay doesn't affect the button text.
    await expect(negativeBtn(page)).toHaveText('N');
    await expect(positiveBtn(page)).toHaveText('Y');
  });
});
