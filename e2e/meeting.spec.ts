import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("會議室", () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, "USER");
  });

  test("列表頁顯示標題與預約按鈕", async ({ page }) => {
    await page.goto("/meeting");
    await expect(page.getByRole("heading", { name: "會議室" })).toBeVisible();
    await expect(page.getByRole("link", { name: /預約會議室/ })).toBeVisible();
  });

  test("列表頁顯示日曆（月視圖）", async ({ page }) => {
    await page.goto("/meeting");
    for (const day of ["日", "一", "二", "三", "四", "五", "六"]) {
      await expect(page.getByText(day, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "今天" })).toBeVisible();
    await expect(page.getByRole("button", { name: "月", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "日", exact: true })).toBeVisible();
  });

  test("點預約會議室跳到表單頁", async ({ page }) => {
    await page.goto("/meeting");
    await page.getByRole("link", { name: /預約會議室/ }).click();
    await expect(page).toHaveURL(/\/meeting\/book/);
    await expect(page.getByRole("heading", { name: "預約會議室" })).toBeVisible();
  });

  test("表單頁顯示所有必要欄位", async ({ page }) => {
    await page.goto("/meeting/book");
    await expect(page.getByLabel("會議室")).toBeVisible();
    await expect(page.getByLabel("日期")).toBeVisible();
    await expect(page.getByLabel("起始時間")).toBeVisible();
    await expect(page.getByLabel("結束時間")).toBeVisible();
    await expect(page.getByLabel("會議主題")).toBeVisible();
    await expect(page.getByRole("button", { name: "確認預約" })).toBeVisible();
    await expect(page.getByRole("button", { name: "取消" })).toBeVisible();
  });

  test("會議室下拉選單包含測試會議室", async ({ page }) => {
    await page.goto("/meeting/book");
    await expect(
      page.locator('select[name="roomId"] option[value="test-room-id"]')
    ).toBeAttached();
  });

  test("取消按鈕返回上一頁", async ({ page }) => {
    await page.goto("/meeting");
    await page.getByRole("link", { name: /預約會議室/ }).click();
    await expect(page).toHaveURL(/\/meeting\/book/);
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page).toHaveURL(/\/meeting$/);
  });

  test("成功送出後跳回日曆頁", async ({ page }) => {
    await page.goto("/meeting/book");

    await page.locator('select[name="roomId"]').selectOption({ value: "test-room-id" });
    await page.getByLabel("日期").fill("2026-12-01");
    await page.locator('select[name="startTime"]').selectOption("09:00");
    await page.locator('select[name="endTime"]').selectOption("10:00");
    await page.getByLabel("會議主題").fill("E2E 測試會議");
    await page.getByRole("button", { name: "確認預約" }).click();

    await expect(page).toHaveURL(/\/meeting$/);
    await expect(page.getByRole("heading", { name: "會議室" })).toBeVisible();
  });

  test("起始時間等於結束時間顯示錯誤", async ({ page }) => {
    await page.goto("/meeting/book");

    await page.locator('select[name="roomId"]').selectOption({ value: "test-room-id" });
    await page.getByLabel("日期").fill("2026-12-02");
    await page.locator('select[name="startTime"]').selectOption("10:00");
    await page.locator('select[name="endTime"]').selectOption("10:00");
    await page.getByLabel("會議主題").fill("時間錯誤測試");
    await page.getByRole("button", { name: "確認預約" }).click();

    await expect(page.getByText("結束時間須晚於起始時間")).toBeVisible();
  });

  test("同一時段重複預約顯示衝突錯誤", async ({ page }) => {
    // 先建立一筆預約
    await page.goto("/meeting/book");
    await page.locator('select[name="roomId"]').selectOption({ value: "test-room-id" });
    await page.getByLabel("日期").fill("2026-12-03");
    await page.locator('select[name="startTime"]').selectOption("14:00");
    await page.locator('select[name="endTime"]').selectOption("15:00");
    await page.getByLabel("會議主題").fill("衝突測試第一筆");
    await page.getByRole("button", { name: "確認預約" }).click();
    await expect(page).toHaveURL(/\/meeting$/);

    // 再預約相同時段
    await page.goto("/meeting/book");
    await page.locator('select[name="roomId"]').selectOption({ value: "test-room-id" });
    await page.getByLabel("日期").fill("2026-12-03");
    await page.locator('select[name="startTime"]').selectOption("14:00");
    await page.locator('select[name="endTime"]').selectOption("15:00");
    await page.getByLabel("會議主題").fill("衝突測試第二筆");
    await page.getByRole("button", { name: "確認預約" }).click();

    await expect(page.getByText("該時段已被預約")).toBeVisible();
  });

  test("day 視圖顯示當天預約", async ({ page }) => {
    // 先建立預約
    await page.goto("/meeting/book");
    await page.locator('select[name="roomId"]').selectOption({ value: "test-room-id" });
    await page.getByLabel("日期").fill("2026-12-04");
    await page.locator('select[name="startTime"]').selectOption("11:00");
    await page.locator('select[name="endTime"]').selectOption("12:00");
    await page.getByLabel("會議主題").fill("Day 視圖測試會議");
    await page.getByRole("button", { name: "確認預約" }).click();
    await expect(page).toHaveURL(/\/meeting$/);

    // 切到 day 視圖
    await page.getByRole("button", { name: "日", exact: true }).click();
    await expect(page.locator("text=的預約").first()).toBeVisible();
  });
});
