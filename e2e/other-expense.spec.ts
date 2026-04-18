import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("其他費用申請單", () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, "USER");
  });

  test("列表頁顯示標題與新增按鈕", async ({ page }) => {
    await page.goto("/other-expense");
    await expect(
      page.getByRole("heading", { name: "其他費用申請單" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /新增申請單/ })).toBeVisible();
  });

  test("新增頁顯示必要欄位與明細表", async ({ page }) => {
    await page.goto("/other-expense/new");
    await expect(
      page.getByRole("heading", { name: "新增其他費用申請單" }),
    ).toBeVisible();
    await expect(page.getByLabel("年度")).toBeVisible();
    await expect(page.getByLabel("月份")).toBeVisible();
    await expect(page.getByRole("button", { name: /送出申請單/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /新增一列/ })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "品名" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "合計" })).toBeVisible();
  });

  test("填寫明細後合計即時計算（數量 × 單價）", async ({ page }) => {
    await page.goto("/other-expense/new");

    const firstRow = page.locator("tbody tr").first();
    await firstRow.locator('input[type="date"]').fill("2026-04-10");
    await firstRow.locator('input[placeholder="品名"]').fill("影印紙");
    await firstRow.locator('input[placeholder="用途說明"]').fill("辦公室耗材");

    const numberInputs = firstRow.locator('input[type="number"]');
    // 數量 3 × 單價 120 = 360
    await numberInputs.nth(0).fill("3");
    await numberInputs.nth(1).fill("120");

    // 合計欄（第 6 欄，index 5）
    await expect(firstRow.locator("td").nth(5)).toContainText("360");
  });

  test("取消按鈕返回上一頁", async ({ page }) => {
    await page.goto("/other-expense");
    await page.getByRole("link", { name: /新增申請單/ }).click();
    await expect(page).toHaveURL(/\/other-expense\/new/);
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page).toHaveURL(/\/other-expense$/);
  });
});
