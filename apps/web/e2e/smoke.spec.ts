import { test, expect } from "@playwright/test";

test.describe("Dual portal smoke", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /sign|log|in/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test("dashboard redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("superadmin routes redirect to login when unauthenticated", async ({ page }) => {
    await page.goto("/superadmin/analytics");
    await expect(page).toHaveURL(/\/login/);
  });

  test("reports redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/login/);
  });
});
