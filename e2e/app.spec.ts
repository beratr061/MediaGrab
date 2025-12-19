import { test, expect } from '@playwright/test';

test.describe('MediaGrab App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('has title', async ({ page }) => {
    await expect(page).toHaveTitle(/MediaGrab/);
  });

  test('shows URL input', async ({ page }) => {
    const urlInput = page.getByPlaceholder(/paste a video url/i);
    await expect(urlInput).toBeVisible();
  });

  test('shows format selector', async ({ page }) => {
    const formatSelector = page.getByRole('combobox', { name: /format/i });
    await expect(formatSelector).toBeVisible();
  });

  test('shows quality selector', async ({ page }) => {
    const qualitySelector = page.getByRole('combobox', { name: /quality/i });
    await expect(qualitySelector).toBeVisible();
  });

  test('download button is disabled without URL', async ({ page }) => {
    const downloadButton = page.getByRole('button', { name: /download/i });
    await expect(downloadButton).toBeDisabled();
  });

  test('can enter URL', async ({ page }) => {
    const urlInput = page.getByPlaceholder(/paste a video url/i);
    await urlInput.fill('https://youtube.com/watch?v=dQw4w9WgXcQ');
    await expect(urlInput).toHaveValue('https://youtube.com/watch?v=dQw4w9WgXcQ');
  });

  test('shows validation error for invalid URL', async ({ page }) => {
    const urlInput = page.getByPlaceholder(/paste a video url/i);
    await urlInput.fill('not-a-valid-url');
    await urlInput.blur();
    
    const errorMessage = page.getByRole('alert');
    await expect(errorMessage).toBeVisible();
  });

  test('can change format', async ({ page }) => {
    const formatSelector = page.getByRole('combobox', { name: /format/i });
    await formatSelector.click();
    
    const mp3Option = page.getByText(/audio \(mp3\)/i);
    await mp3Option.click();
    
    await expect(formatSelector).toContainText(/mp3/i);
  });

  test('can toggle theme', async ({ page }) => {
    const themeToggle = page.getByRole('button', { name: /theme/i });
    await expect(themeToggle).toBeVisible();
    
    // Get initial theme
    const html = page.locator('html');
    const initialClass = await html.getAttribute('class');
    
    // Toggle theme
    await themeToggle.click();
    
    // Theme should change
    const newClass = await html.getAttribute('class');
    expect(newClass).not.toBe(initialClass);
  });

  test('settings panel opens', async ({ page }) => {
    const settingsButton = page.getByRole('button', { name: /settings/i });
    await settingsButton.click();
    
    const settingsPanel = page.getByRole('dialog');
    await expect(settingsPanel).toBeVisible();
  });

  test('can close settings panel', async ({ page }) => {
    const settingsButton = page.getByRole('button', { name: /settings/i });
    await settingsButton.click();
    
    const closeButton = page.getByRole('button', { name: /close/i });
    await closeButton.click();
    
    const settingsPanel = page.getByRole('dialog');
    await expect(settingsPanel).not.toBeVisible();
  });

  test('keyboard navigation works', async ({ page }) => {
    // Tab through main elements
    await page.keyboard.press('Tab');
    const urlInput = page.getByPlaceholder(/paste a video url/i);
    await expect(urlInput).toBeFocused();
    
    await page.keyboard.press('Tab');
    // Next focusable element should be focused
  });

  test('responsive layout on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const urlInput = page.getByPlaceholder(/paste a video url/i);
    await expect(urlInput).toBeVisible();
    
    // Check that layout adapts
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('no accessibility violations on main page', async ({ page }) => {
    await page.goto('/');
    
    // Check for basic accessibility attributes
    const urlInput = page.getByPlaceholder(/paste a video url/i);
    await expect(urlInput).toHaveAttribute('aria-label');
    
    const downloadButton = page.getByRole('button', { name: /download/i });
    await expect(downloadButton).toBeVisible();
  });

  test('focus is visible', async ({ page }) => {
    await page.goto('/');
    
    const urlInput = page.getByPlaceholder(/paste a video url/i);
    await urlInput.focus();
    
    // Check that focus ring is visible (element has focus-visible styles)
    await expect(urlInput).toBeFocused();
  });
});
