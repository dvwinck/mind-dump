import { test, expect } from '@playwright/test';

const column = (page, category) => page.locator(`.kanban-grid .category-column[data-category="${category}"]`);

async function addNote(page, category, text) {
  const input = column(page, category).locator('.note-input');
  await input.fill(text);
  await input.press('Enter');
}

test.describe('Mind Dump smoke', () => {
  test('creates a note and keeps it after a reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await addNote(page, 'tasks', 'Comprar café');
    await expect(column(page, 'tasks').locator('.note-card')).toContainText('Comprar café');

    await page.reload();
    await expect(column(page, 'tasks').locator('.note-card')).toContainText('Comprar café');
  });

  test('renders note text as text, never as HTML', async ({ page }) => {
    let dialogOpened = false;
    page.on('dialog', (dialog) => {
      dialogOpened = true;
      dialog.dismiss();
    });

    await page.goto('/');
    await addNote(page, 'unclear', '<img src=x onerror="alert(1)">');

    await expect(column(page, 'unclear').locator('.note-card')).toContainText('<img src=x');
    await expect(column(page, 'unclear').locator('.note-card img')).toHaveCount(0);
    expect(dialogOpened).toBe(false);
  });

  test('keeps working offline once the service worker is in control', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    // The first load is not controlled yet; reload so the worker serves the page
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await addNote(page, 'projects', 'Funciona sem rede');

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(column(page, 'projects').locator('.note-card')).toContainText('Funciona sem rede');
  });
});
