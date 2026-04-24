import { BrowserContext, Page } from "@playwright/test";

const TEST_USER_IDS = {
  ADMIN: "test-admin-id",
  USER: "test-user-id",
};

export async function loginAs(
  context: BrowserContext,
  role: "ADMIN" | "USER" = "ADMIN",
) {
  const userId = TEST_USER_IDS[role];
  const page = await context.newPage();
  const e2eSecret = process.env.E2E_SECRET;
  if (e2eSecret) {
    await page.goto(`/api/e2e-login?secret=${e2eSecret}&userId=${userId}`);
  } else {
    await page.goto(`/api/dev-login?userId=${userId}`);
  }
  await page.close();
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}
