import { test, expect } from "@playwright/test";

const SUPERADMIN_EMAIL = process.env.E2E_SUPERADMIN_EMAIL;
const SUPERADMIN_PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD;
const PARTNER_EMAIL = process.env.E2E_PARTNER_EMAIL;
const PARTNER_PASSWORD = process.env.E2E_PARTNER_PASSWORD;

test.describe("Auth flows (requires E2E_* env)", () => {
  test.skip(!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD, "E2E_SUPERADMIN_EMAIL and E2E_SUPERADMIN_PASSWORD must be set");

  test("superadmin can reach Superadmin Dashboard after login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(SUPERADMIN_EMAIL!);
    await page.getByLabel(/password/i).fill(SUPERADMIN_PASSWORD!);
    await page.getByRole("button", { name: /sign|in|iniciar|sesión/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|superadmin)/, { timeout: 15000 });
    await page.goto("/superadmin/dashboard");
    await expect(page).toHaveURL(/\/superadmin\/dashboard/);
    await expect(page.getByText(/dashboard|analytics|partners|kpi/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("superadmin can open Global Reports and see export options", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(SUPERADMIN_EMAIL!);
    await page.getByLabel(/password/i).fill(SUPERADMIN_PASSWORD!);
    await page.getByRole("button", { name: /sign|in|iniciar|sesión/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|superadmin)/, { timeout: 15000 });
    await page.goto("/superadmin/reports");
    await expect(page).toHaveURL(/\/superadmin\/reports/);
    await expect(page.getByRole("link", { name: /export|csv|excel/i }).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Partner user flows (requires E2E_PARTNER_* env)", () => {
  test.skip(!PARTNER_EMAIL || !PARTNER_PASSWORD, "E2E_PARTNER_EMAIL and E2E_PARTNER_PASSWORD must be set");

  test("partner user reaches dashboard and does not see Sales/Admin in nav", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(PARTNER_EMAIL!);
    await page.getByLabel(/password/i).fill(PARTNER_PASSWORD!);
    await page.getByRole("button", { name: /sign|in|iniciar|sesión/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|pending)/, { timeout: 15000 });
    if (page.url().includes("/pending")) {
      test.skip(true, "Partner user has no org (pending); cannot assert nav");
      return;
    }
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("link", { name: /sales/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /admin/i })).not.toBeVisible();
  });
});
