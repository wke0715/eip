import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("未登入", () => {
  test("首頁應 redirect 到登入頁", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("登入頁顯示正確內容", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText("使用 Google 帳號登入")).toBeVisible();
  });
});

test.describe("ADMIN 登入後", () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, "ADMIN");
  });

  test("可以進到儀表板", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("aside a").first()).toBeVisible();
  });

  test("側邊欄顯示管理員選單", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("人員管理")).toBeVisible();
    await expect(page.getByText("系統 Log")).toBeVisible();
  });

  test("可以進人員管理頁面", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "人員管理" })).toBeVisible();
    await expect(page.getByText("新增使用者")).toBeVisible();
  });

  test("可以進系統設定頁面", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page).not.toHaveURL(/\/forbidden/);
  });
});

test.describe("USER 登入後", () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, "USER");
  });

  test("無法進管理員頁面，應顯示 403", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/forbidden/);
    await expect(page.getByText("禁止存取")).toBeVisible();
  });

  test("可以進請假單頁面", async ({ page }) => {
    await page.goto("/leave");
    await expect(page).not.toHaveURL(/\/forbidden/);
  });
});
