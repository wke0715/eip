import { BrowserContext, Page } from "@playwright/test";

const TEST_USER_IDS = {
  ADMIN: "test-admin-id",
  USER: "test-user-id",
};

export async function loginAs(
  context: BrowserContext,
  role: "ADMIN" | "USER" = "ADMIN"
) {
  const userId = TEST_USER_IDS[role];
  // 透過 dev-login API 讓 server 自行簽發 JWT，確保 secret 一致
  // 且 DB 的 role 欄位與 JWT 一致，避免 jwt callback 覆蓋錯誤角色
  const page = await context.newPage();
  await page.goto(`/api/dev-login?userId=${userId}`);
  await page.close();
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}
