// tests/e2e/ingestion.spec.js
// E2E: template selection, record creation, editing, and AI proxy mock parsing.

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Fresh client state each run.
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {}
  });
});

test('app boots and seeds built-in templates', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('#template-list .nav-item');
  await expect(nav.first()).toBeVisible();
  // Nine generic built-in templates.
  await expect(nav).toHaveCount(9);
  await expect(page.locator('.sidebar-brand')).toContainText('Foremark');
});

test('select Issues template and create a record', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Issues & Tickets').click();
  await expect(page.locator('#workspace-title')).toContainText('Issues');

  await page.getByRole('button', { name: '＋ New Record' }).click();

  // A table row should appear with an editable subject cell.
  const firstCell = page.locator('.data-table tbody tr').first().locator('input').first();
  await expect(firstCell).toBeVisible();
  await firstCell.fill('Login button unresponsive on mobile');
  await firstCell.blur();

  // Reload — the record must persist server-side.
  await page.reload();
  await page.getByText('Issues & Tickets').click();
  await expect(
    page.locator('.data-table tbody tr').first().locator('input').first()
  ).toHaveValue('Login button unresponsive on mobile');
});

test('switch between table, kanban, and cards views', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Task & Project Tracker').click();

  // Populate with sample data so every view has content to render.
  await page.getByRole('button', { name: '🎲 Sample Data' }).click();
  await expect(page.locator('.toast.success')).toBeVisible();

  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  await expect(page.locator('.kanban')).toBeVisible();
  await expect(page.locator('.kanban-col')).toHaveCount(4); // backlog,todo,in-progress,done

  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await expect(page.locator('.cards-grid')).toBeVisible();
  await expect(page.locator('.record-card').first()).toBeVisible();

  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await expect(page.locator('.data-table')).toBeVisible();
});

test('Sample Data button generates demo records', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Contacts & CRM').click();
  await page.getByRole('button', { name: '🎲 Sample Data' }).click();
  await expect(page.locator('.toast.success')).toBeVisible();
  // Rows should now exist in the table.
  await expect(page.locator('.data-table tbody tr').first()).toBeVisible();
  const rowCount = await page.locator('.data-table tbody tr').count();
  expect(rowCount).toBeGreaterThan(0);
});

test('architecture diagram renders nodes and connections', async ({ page }) => {
  await page.goto('/');
  await page.getByText('System Architecture Map').click();
  // Default view is the diagram; seed the curated demo architecture.
  await page.getByRole('button', { name: '🎲 Sample Data' }).click();
  await expect(page.locator('.toast.success')).toBeVisible();
  await expect(page.locator('.arch-node').first()).toBeVisible();
  const nodes = await page.locator('.arch-node').count();
  expect(nodes).toBeGreaterThan(5);
  // Connection edges are drawn on the next animation frame — poll until present.
  await expect
    .poll(() => page.locator('.diagram-svg path.edge').count())
    .toBeGreaterThan(0);
});

test('turning off demo mode removes demo data', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Inventory & Assets').click();
  await page.getByRole('button', { name: '🎲 Sample Data' }).click();
  await expect(page.locator('.toast.success')).toBeVisible();
  await expect(page.locator('.data-table tbody tr').first()).toBeVisible();

  // Enable then disable demo mode; disabling must delete the sample records.
  await page.getByRole('button', { name: /Demo:/ }).click(); // on
  await page.getByRole('button', { name: /Demo:/ }).click(); // off
  await expect(page.locator('.data-table tbody tr')).toHaveCount(0);
});

test('Parse & Ingest surfaces AI errors gracefully (no key configured)', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByText('Meeting Notes').click();
  await page.getByRole('button', { name: '✨ Parse & Ingest' }).click();

  await expect(page.locator('.modal')).toBeVisible();
  await page.locator('#ingest-text').fill('Weekly sync: agreed to ship beta Friday.');
  await page.getByRole('button', { name: 'Extract' }).click();

  // With no API key set, the server returns a 400 which becomes an error toast.
  await expect(page.locator('.toast.error')).toBeVisible({ timeout: 10_000 });
});
