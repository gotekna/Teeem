import { test as setup } from '@playwright/test';

/**
 * Authentication setup for E2E tests
 * This runs once before all tests and saves the authenticated state
 */

const authFile = 'tests/.auth/user.json';

setup('authenticate', async ({ page }) => {
  console.log('🔐 Setting up authentication...');

  // Navigate to login page
  await page.goto('/');

  // Wait for login form
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

  // Fill in credentials
  const email = process.env.TEST_EMAIL || 'admin@teeem.com';
  const password = process.env.TEST_PASSWORD || 'password';

  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for navigation after login
  await page.waitForURL(/^(?!.*login).*$/, { timeout: 10000 });

  console.log('✅ Authentication successful');

  // Save authenticated state
  await page.context().storageState({ path: authFile });
});
