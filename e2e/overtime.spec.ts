import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("加班單", () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, "USER");
  });

  test("列表頁顯示標題與新增按鈕", async ({ page }) => {
    await page.goto("/overtime");
    await expect(page.getByRole("heading", { name: "加班單" })).toBeVisible();
    await expect(page.getByRole("link", { name: /新增加班單/ })).toBeVisible();
  });

  test("新增頁顯示必要欄位與明細表", async ({ page }) => {
    await page.goto("/overtime/new");
    await expect(
      page.getByRole("heading", { name: "新增加班單" }),
    ).toBeVisible();
    await expect(page.getByLabel("年度")).toBeVisible();
    await expect(page.getByLabel("月份")).toBeVisible();
    await expect(page.getByRole("button", { name: /送出加班單/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /新增一列/ })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "加班日期" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "加班時數" })).toBeVisible();
  });

  test("加班時數超過 46h 顯示警示（但不阻擋送出）", async ({ page }) => {
    await page.goto("/overtime/new");

    // 預設已有 1 列（8h），再加 5 列湊滿 48h > 46h
    for (let i = 0; i < 5; i += 1) {
      await page.getByRole("button", { name: /新增一列/ }).click();
    }

    await expect(page.getByText(/已超過 46h 上限/)).toBeVisible();
  });

  test("取消按鈕返回上一頁", async ({ page }) => {
    await page.goto("/overtime");
    await page.getByRole("link", { name: /新增加班單/ }).click();
    await expect(page).toHaveURL(/\/overtime\/new/);
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page).toHaveURL(/\/overtime$/);
  });
});
