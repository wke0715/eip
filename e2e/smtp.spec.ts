import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// SMTP 測試共用同一筆 DB config，需循序執行避免互相干擾
test.describe.configure({ mode: "serial" });

test.describe("SMTP 管理", () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, "ADMIN");
  });

  test("頁面顯示標題與表單欄位", async ({ page }) => {
    await page.goto("/admin/smtp");

    await expect(page.getByRole("heading", { name: "SMTP 管理" })).toBeVisible();
    await expect(page.getByLabel("SMTP Host")).toBeVisible();
    await expect(page.getByLabel("Port")).toBeVisible();
    await expect(page.getByLabel("帳號")).toBeVisible();
    await expect(page.getByLabel("密碼")).toBeVisible();
    await expect(page.getByLabel("寄件人名稱")).toBeVisible();
    await expect(page.getByLabel("寄件人 Email")).toBeVisible();
    await expect(page.getByLabel("加密方式")).toBeVisible();
    await expect(page.getByRole("button", { name: "儲存設定" })).toBeVisible();
    await expect(page.getByRole("button", { name: "發送測試信" })).toBeVisible();
  });

  test("尚未設定 SMTP 時點發送測試信，顯示錯誤訊息", async ({ page }) => {
    // global-setup 已清空 SmtpConfig，此時 DB 應無設定
    await page.goto("/admin/smtp");

    await page.getByRole("button", { name: "發送測試信" }).click();

    await expect(page.getByText("尚未設定 SMTP，請先儲存設定")).toBeVisible();
  });

  test("填寫完整表單並儲存，顯示成功訊息", async ({ page }) => {
    await page.goto("/admin/smtp");

    await page.getByLabel("SMTP Host").fill("smtp.example.com");
    await page.getByLabel("Port").fill("587");
    await page.getByLabel("帳號").fill("admin@example.com");
    await page.getByLabel("密碼").fill("secret123");
    await page.getByLabel("寄件人名稱").fill("企盉 EIP 系統");
    await page.getByLabel("寄件人 Email").fill("noreply@example.com");
    await page.locator("select[name='encryption']").selectOption("TLS");

    await page.getByRole("button", { name: "儲存設定" }).click();

    await expect(page.getByText("SMTP 設定已儲存")).toBeVisible();
  });

  test("儲存後重新整理，欄位帶入既有設定（密碼除外）", async ({ page }) => {
    await page.goto("/admin/smtp");

    await page.getByLabel("SMTP Host").fill("smtp.reload-test.com");
    await page.getByLabel("Port").fill("465");
    await page.getByLabel("帳號").fill("user@reload-test.com");
    await page.getByLabel("密碼").fill("reloadpass");
    await page.getByLabel("寄件人名稱").fill("重新整理測試");
    await page.getByLabel("寄件人 Email").fill("sender@reload-test.com");
    await page.locator("select[name='encryption']").selectOption("SSL");

    await page.getByRole("button", { name: "儲存設定" }).click();
    await expect(page.getByText("SMTP 設定已儲存")).toBeVisible();

    await page.reload();

    await expect(page.getByLabel("SMTP Host")).toHaveValue("smtp.reload-test.com");
    await expect(page.getByLabel("Port")).toHaveValue("465");
    await expect(page.getByLabel("帳號")).toHaveValue("user@reload-test.com");
    await expect(page.getByLabel("密碼")).toHaveValue(""); // 密碼不回填
    await expect(page.getByLabel("寄件人名稱")).toHaveValue("重新整理測試");
    await expect(page.getByLabel("寄件人 Email")).toHaveValue("sender@reload-test.com");
    await expect(page.locator("select[name='encryption']")).toHaveValue("SSL");
  });

  test("儲存設定後點發送測試信，回傳連線結果", async ({ page }) => {
    // 沿用上一個 test 已存的 config（smtp.reload-test.com），
    // host 不存在所以連線失敗，但應顯示明確錯誤而非「尚未設定」
    await page.goto("/admin/smtp");

    await page.getByRole("button", { name: "發送測試信" }).click();

    // 不應再顯示「尚未設定」
    await expect(page.getByText("尚未設定 SMTP，請先儲存設定")).not.toBeVisible();
    // 應顯示連線錯誤訊息
    await expect(page.locator("p.text-sm")).toBeVisible();
  });

  test("缺少必填欄位時，表單不送出", async ({ page }) => {
    await page.goto("/admin/smtp");

    await page.getByLabel("SMTP Host").fill("");
    await page.getByRole("button", { name: "儲存設定" }).click();

    await expect(page.getByText("SMTP 設定已儲存")).not.toBeVisible();
  });
});
