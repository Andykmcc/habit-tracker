import { expect, type Page } from '@playwright/test';

// A fixed "today" so calendar layout and streak math are deterministic across
// runs. 2025-06-16 is a Monday; the 15th is the day before, both in June 2025.
export const FIXED_NOW = new Date('2025-06-16T10:00:00');
export const TODAY = '2025-06-16';
export const YESTERDAY = '2025-06-15';

/** Load the app with a frozen clock and no onboarding toast, ready to drive. */
export async function gotoApp(page: Page, now: Date = FIXED_NOW): Promise<void> {
  await page.clock.setFixedTime(now);
  // Suppress the first-run onboarding toast so it never overlaps controls.
  await page.addInitScript(() => {
    localStorage.setItem('habit-tracker-onboarding-dismissed', 'true');
  });
  await page.goto('/');
  // The app auto-creates a "Daily Habit" on first load.
  await expect(habitName(page)).toHaveValue('Daily Habit');
}

// --- Daily action ---
export const positiveBtn = (page: Page) => page.locator('.daily-action-positive-btn');
export const negativeBtn = (page: Page) => page.locator('.daily-action-negative-btn');
export const noteBox = (page: Page) => page.locator('.daily-action-note');

// --- Header ---
export const habitName = (page: Page) => page.locator('.habit-header-name');

// Value of the stat card with the given caption, e.g. statValue(page, 'Current Streak').
export const statValue = (page: Page, name: string) =>
  page
    .locator('.bg-white', { has: page.locator('.stat-card-name', { hasText: name }) })
    .locator('.stat-card-value');

// --- Calendar ---
export const dayCell = (page: Page, date: string) => page.locator(`[data-date="${date}"]`);
export const dayCircle = (page: Page, date: string) => dayCell(page, date).locator('div').first();

// --- Habit selector ---
export const openHabitMenu = (page: Page) => page.locator('.habit-selector-trigger').click();
