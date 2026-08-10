import { test, expect } from "@playwright/test";

// Exercises the real login flow end to end against a running dev server +
// database. Requires the standard seeded accounts (see prisma/seed.ts) —
// run `npx prisma db seed` against a local database before running this.
const SELLER_EMAIL = "vendedor@maxledtec.com.br";
const SELLER_PASSWORD = "maxled123";

test("logs in with correct credentials and reaches Início", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", SELLER_EMAIL);
  await page.fill("#password", SELLER_PASSWORD);
  await page.click('button[type="submit"]');

  await expect(page.locator("h3", { hasText: "Prospecções" })).toBeVisible({ timeout: 15000 });
});

test("rejects a wrong password with a clear error, no redirect", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", SELLER_EMAIL);
  await page.fill("#password", "senha-errada-de-proposito");
  await page.click('button[type="submit"]');

  await expect(page.locator("text=E-mail ou senha incorretos.")).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/login$/);
});
