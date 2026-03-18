import { test, expect } from "@playwright/test";

const SUPERADMIN_EMAIL = process.env.E2E_SUPERADMIN_EMAIL;
const SUPERADMIN_PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD;
const PARTNER_EMAIL = process.env.E2E_PARTNER_EMAIL;
const PARTNER_PASSWORD = process.env.E2E_PARTNER_PASSWORD;

test.describe("Warehouses flows (Superadmin + Partner)", () => {
  test.skip(
    !SUPERADMIN_EMAIL ||
      !SUPERADMIN_PASSWORD ||
      !PARTNER_EMAIL ||
      !PARTNER_PASSWORD,
    "E2E_SUPERADMIN_* and E2E_PARTNER_* env vars must be set to run warehouse flows"
  );

  test("superadmin can create factory warehouse from Superadmin inventory", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(SUPERADMIN_EMAIL!);
    await page.getByLabel(/password/i).fill(SUPERADMIN_PASSWORD!);
    await page
      .getByRole("button", { name: /sign|in|iniciar|sesión/i })
      .click();
    await expect(page).toHaveURL(/\/superadmin\/dashboard|\/dashboard/, {
      timeout: 15000,
    });

    await page.goto("/superadmin/admin/warehouses");
    await expect(page).toHaveURL(/\/superadmin\/admin\/warehouses/);

    await page
      .getByRole("button", { name: /new|create|add.*warehouse|bodega/i })
      .first()
      .click();

    const name = `E2E Factory Warehouse ${Date.now()}`;
    await page.getByLabel(/name|nombre/i).fill(name);
    const locationField = page.getByLabel(/location|ubicación/i).first();
    if (await locationField.isVisible()) {
      await locationField.fill("Factory");
    }

    await page
      .getByRole("button", { name: /save|guardar|create|crear/i })
      .click();

    await expect(
      page.getByText(name, { exact: false }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("partner can create own warehouse from Settings > Warehouses", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(PARTNER_EMAIL!);
    await page.getByLabel(/password/i).fill(PARTNER_PASSWORD!);
    await page
      .getByRole("button", { name: /sign|in|iniciar|sesión/i })
      .click();

    await expect(page).toHaveURL(/\/dashboard|\/pending/, { timeout: 15000 });
    if (page.url().includes("/pending")) {
      test.skip(true, "Partner user has no active organization (pending)");
      return;
    }

    await page.goto("/settings/warehouses");
    await expect(page).toHaveURL(/\/settings\/warehouses/);

    await page
      .getByRole("button", { name: /new|create|add.*warehouse|bodega/i })
      .first()
      .click();

    const name = `E2E Partner Warehouse ${Date.now()}`;
    await page.getByLabel(/name|nombre/i).fill(name);
    const locationField = page.getByLabel(/location|ubicación/i).first();
    if (await locationField.isVisible()) {
      await locationField.fill("Partner location");
    }

    await page
      .getByRole("button", { name: /save|guardar|create|crear/i })
      .click();

    await expect(
      page.getByText(name, { exact: false }).first()
    ).toBeVisible({ timeout: 15000 });
  });
}
