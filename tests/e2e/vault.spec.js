// tests/e2e/vault.spec.js
// E2E: encrypted field locking/unlocking round-trip.

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  // Reset the server-side vault so each test starts uninitialized, and
  // clear client settings for a clean slate.
  await request.post('/api/vault/settings', { data: {} });
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {}
  });
});

test('vault set up, encrypt a secret, lock, and re-unlock', async ({ page }) => {
  await page.goto('/');

  // Vault starts locked.
  await expect(page.locator('#vault-indicator')).toContainText('locked');

  // Open the secrets template.
  await page.getByText('Encrypted Secrets Vault').click();

  // Set up the vault with a passphrase.
  await page.getByRole('button', { name: 'Vault', exact: true }).click();
  await expect(page.locator('.modal')).toBeVisible();
  await page.locator('#vp').fill('hunter2pass');
  await page.getByRole('button', { name: /Create vault|Unlock/ }).click();
  await expect(page.locator('#vault-indicator')).toContainText('unlocked');

  // Create a record.
  await page.getByRole('button', { name: '＋ New Record' }).click();
  const row = page.locator('.data-table tbody tr').first();
  await row.locator('input').first().fill('GitHub');

  // Set the encrypted secret via the reveal/set flow.
  await row.getByRole('button', { name: /Set|Reveal/ }).click();
  await expect(page.locator('.modal')).toBeVisible();
  await page.locator('#enc-input').fill('super-secret-token');
  await page.getByRole('button', { name: 'Save encrypted' }).click();
  await expect(page.getByText('Encrypted value saved')).toBeVisible();

  // Lock the vault.
  await page.getByRole('button', { name: 'Vault', exact: true }).click();
  await page.getByRole('button', { name: 'Lock vault' }).click();
  await expect(page.locator('#vault-indicator')).toContainText('locked');

  // Reload: data persists, but is encrypted at rest.
  await page.reload();
  await page.getByText('Encrypted Secrets Vault').click();
  const reloadedRow = page.locator('.data-table tbody tr').first();
  await expect(reloadedRow.locator('.enc-value')).toContainText('encrypted');

  // Attempting to reveal while locked shows an error toast.
  await reloadedRow.getByRole('button', { name: /Reveal|Set/ }).click();
  await expect(page.getByText(/Unlock the vault/)).toBeVisible();

  // Unlock again and reveal the plaintext.
  await page.getByRole('button', { name: 'Vault', exact: true }).click();
  await page.locator('#vp').fill('hunter2pass');
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.locator('#vault-indicator')).toContainText('unlocked');

  await reloadedRow.getByRole('button', { name: /Reveal/ }).click();
  await expect(page.locator('#enc-input')).toHaveValue('super-secret-token');
});

test('wrong passphrase is rejected on unlock', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Encrypted Secrets Vault').click();

  // Initialize the vault.
  await page.getByRole('button', { name: 'Vault', exact: true }).click();
  await page.locator('#vp').fill('correct-pass');
  await page.getByRole('button', { name: /Create vault/ }).click();
  await expect(page.locator('#vault-indicator')).toContainText('unlocked');

  // Lock it.
  await page.getByRole('button', { name: 'Vault', exact: true }).click();
  await page.getByRole('button', { name: 'Lock vault' }).click();

  // Try a bad passphrase.
  await page.getByRole('button', { name: 'Vault', exact: true }).click();
  await page.locator('#vp').fill('wrong-pass');
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByText(/Incorrect passphrase/)).toBeVisible();
});
