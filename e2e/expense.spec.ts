import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("出差旅費報告單", () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, "USER");
  });

  test("列表頁顯示標題與新增按鈕", async ({ page }) => {
    await page.goto("/expense");
    await expect(
      page.getByRole("heading", { name: "出差旅費報告單" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /新增報告單/ })).toBeVisible();
  });

  test("新增頁顯示必要欄位與明細表", async ({ page }) => {
    await page.goto("/expense/new");
    await expect(
      page.getByRole("heading", { name: "新增出差旅費報告單" }),
    ).toBeVisible();
    await expect(page.getByLabel("年度")).toBeVisible();
    await expect(page.getByLabel("月份")).toBeVisible();
    await expect(page.getByRole("button", { name: /送出報告單/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /新增一列/ })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "日期" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "小計" })).toBeVisible();
  });

  test("新增一列後可填寫並在小計顯示加總", async ({ page }) => {
    await page.goto("/expense/new");

    const firstRow = page.locator("tbody tr").first();
    await firstRow.locator('input[type="date"]').fill("2026-04-10");
    await firstRow
      .locator('input[placeholder*="客戶"]')
      .fill("客戶_S 台北→台中");

    // 填三個數字欄位：私車補貼 120 + 停車費 50 + ETC 30 = 200
    const numberInputs = firstRow.locator('input[type="number"]');
    await numberInputs.nth(0).fill("120");
    await numberInputs.nth(1).fill("50");
    await numberInputs.nth(2).fill("30");

    // 小計儲存格應顯示 $200（即時計算）
    await expect(firstRow.locator("td").nth(13)).toContainText("200");
  });

  test("取消按鈕返回上一頁", async ({ page }) => {
    await page.goto("/expense");
    await page.getByRole("link", { name: /新增報告單/ }).click();
    await expect(page).toHaveURL(/\/expense\/new/);
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page).toHaveURL(/\/expense$/);
  });
});
