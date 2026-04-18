import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("請假單", () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, "USER");
  });

  test("列表頁顯示標題與新增按鈕", async ({ page }) => {
    await page.goto("/leave");
    await expect(page.getByRole("heading", { name: "請假單" })).toBeVisible();
    await expect(page.getByRole("link", { name: /新增請假單/ })).toBeVisible();
  });

  test("點新增請假單跳到表單頁", async ({ page }) => {
    await page.goto("/leave");
    await page.getByRole("link", { name: /新增請假單/ }).click();
    await expect(page).toHaveURL(/\/leave\/new/);
    await expect(page.getByRole("heading", { name: "新增請假單" })).toBeVisible();
  });

  test("表單頁顯示所有必要欄位", async ({ page }) => {
    await page.goto("/leave/new");
    await expect(page.getByLabel("假別")).toBeVisible();
    await expect(page.getByLabel("起始日期")).toBeVisible();
    await expect(page.getByLabel("結束日期")).toBeVisible();
    await expect(page.getByLabel("請假事由")).toBeVisible();
    await expect(page.getByRole("button", { name: "送出請假單" })).toBeVisible();
    await expect(page.getByRole("button", { name: "取消" })).toBeVisible();
  });

  test("假別有預期的選項", async ({ page }) => {
    await page.goto("/leave/new");
    for (const name of ["特休", "病假", "事假", "公假", "婚假", "喪假", "產假", "陪產假"]) {
      await expect(
        page.locator(`select[name="leaveTypeId"] option`).filter({ hasText: new RegExp(`^${name}$`) })
      ).toBeAttached();
    }
  });

  test("結束日期早於起始日期顯示錯誤", async ({ page }) => {
    await page.goto("/leave/new");
    await page.getByLabel("假別").selectOption({ label: "特休" });
    await page.getByLabel("起始日期").fill("2026-05-10");
    await page.getByLabel("結束日期").fill("2026-05-09");
    await page.getByLabel("請假事由").fill("測試錯誤情境");
    await page.getByRole("button", { name: "送出請假單" }).click();
    await expect(page.getByText("結束日期不能早於起始日期")).toBeVisible();
  });

  test("取消按鈕返回上一頁", async ({ page }) => {
    await page.goto("/leave");
    await page.getByRole("link", { name: /新增請假單/ }).click();
    await expect(page).toHaveURL(/\/leave\/new/);
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page).toHaveURL(/\/leave$/);
  });

  test("成功送出後跳回列表，且出現新紀錄", async ({ page }) => {
    await page.goto("/leave/new");
    await page.getByLabel("假別").selectOption({ label: "事假" });
    await page.getByLabel("起始日期").fill("2026-06-01");
    await page.getByLabel("結束日期").fill("2026-06-01");
    await page.getByLabel("請假事由").fill("E2E 測試請假單");
    await page.getByRole("button", { name: "送出請假單" }).click();

    await expect(page).toHaveURL(/\/leave$/);
    await expect(page.getByRole("cell", { name: "事假" }).first()).toBeVisible();
  });

  test("列表頁顯示請假紀錄表格欄位", async ({ page }) => {
    // 先確保有資料
    await page.goto("/leave/new");
    await page.getByLabel("假別").selectOption({ label: "病假" });
    await page.getByLabel("起始日期").fill("2026-07-01");
    await page.getByLabel("結束日期").fill("2026-07-02");
    await page.getByLabel("請假事由").fill("表格欄位測試");
    await page.getByRole("button", { name: "送出請假單" }).click();
    await expect(page).toHaveURL(/\/leave$/);

    await expect(page.getByRole("columnheader", { name: "表單類型" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "表單編號" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "期間" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "時數/金額" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "狀態" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "申請日期" })).toBeVisible();
  });
});
