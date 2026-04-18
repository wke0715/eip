import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("人員管理", () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, "ADMIN");
  });

  test("頁面顯示標題與新增按鈕", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "人員管理" })).toBeVisible();
    await expect(page.getByText("新增使用者")).toBeVisible();
    // 有使用者時顯示表格，無使用者時顯示提示文字
    const hasUsers = await page.getByRole("table").count() > 0;
    if (hasUsers) {
      await expect(page.getByRole("columnheader", { name: "姓名" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Email" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "狀態" })).toBeVisible();
    } else {
      await expect(page.getByText("尚無使用者")).toBeVisible();
    }
  });

  test("可以開啟新增使用者 Dialog", async ({ page }) => {
    await page.goto("/admin/users");
    await page.getByText("新增使用者").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "新增使用者" })).toBeVisible();
    await expect(dialog.getByLabel("Email")).toBeVisible();
    await expect(dialog.getByLabel("姓名")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "新增" })).toBeVisible();
  });

  test("新增使用者後出現在列表", async ({ page }) => {
    const ts = Date.now();
    const testEmail = `test.add.${ts}@example.com`;
    const testName = `新增用戶${ts}`;

    await page.goto("/admin/users");
    await page.getByText("新增使用者").click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email").fill(testEmail);
    await dialog.getByLabel("姓名").fill(testName);
    await dialog.getByRole("button", { name: "新增" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("cell", { name: testEmail })).toBeVisible();
    await expect(page.getByRole("cell", { name: testName })).toBeVisible();
  });

  test("重複 Email 新增會顯示錯誤訊息", async ({ page }) => {
    const testEmail = `test.dup.${Date.now()}@example.com`;

    await page.goto("/admin/users");

    // 新增第一個使用者
    await page.getByText("新增使用者").click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email").fill(testEmail);
    await dialog.getByLabel("姓名").fill("第一位用戶");
    await dialog.getByRole("button", { name: "新增" }).click();
    await expect(dialog).not.toBeVisible();

    // 嘗試新增重複 Email
    await page.getByText("新增使用者").click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email").fill(testEmail);
    await dialog.getByLabel("姓名").fill("重複用戶");
    await dialog.getByRole("button", { name: "新增" }).click();

    await expect(dialog.getByText("此 Email 已存在")).toBeVisible();
  });

  test("可以編輯使用者姓名", async ({ page }) => {
    const ts = Date.now();
    const testEmail = `test.edit.${ts}@example.com`;
    const editedName = `已編輯${ts}`;

    await page.goto("/admin/users");

    // 先新增一個使用者
    await page.getByText("新增使用者").click();
    const createDialog = page.getByRole("dialog");
    await createDialog.getByLabel("Email").fill(testEmail);
    await createDialog.getByLabel("姓名").fill("待編輯用戶");
    await createDialog.getByRole("button", { name: "新增" }).click();
    await expect(createDialog).not.toBeVisible();

    // 找到該列並點編輯
    const row = page.getByRole("row").filter({ hasText: testEmail });
    await row.getByRole("button", { name: "編輯" }).click();

    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByRole("heading", { name: "編輯使用者" })).toBeVisible();

    const nameInput = editDialog.locator("input[name='name']");
    await nameInput.clear();
    await nameInput.fill(editedName);
    await editDialog.getByRole("button", { name: "儲存" }).click();

    await expect(editDialog).not.toBeVisible();
    // 驗證該列姓名已更新
    const updatedRow = page.getByRole("row").filter({ hasText: testEmail });
    await expect(updatedRow.getByRole("cell", { name: editedName })).toBeVisible();
  });

  test("可以停用使用者，狀態顯示為停用", async ({ page }) => {
    const testEmail = `test.deactivate.${Date.now()}@example.com`;

    await page.goto("/admin/users");

    // 先新增一個使用者
    await page.getByText("新增使用者").click();
    const createDialog = page.getByRole("dialog");
    await createDialog.getByLabel("Email").fill(testEmail);
    await createDialog.getByLabel("姓名").fill("待停用用戶");
    await createDialog.getByRole("button", { name: "新增" }).click();
    await expect(createDialog).not.toBeVisible();

    // 點編輯，把狀態改為停用
    const row = page.getByRole("row").filter({ hasText: testEmail });
    await row.getByRole("button", { name: "編輯" }).click();

    const editDialog = page.getByRole("dialog");
    await editDialog.locator("select[name='isActive']").selectOption("false");
    await editDialog.getByRole("button", { name: "儲存" }).click();
    await expect(editDialog).not.toBeVisible();

    // 確認狀態 badge 顯示「停用」
    const updatedRow = page.getByRole("row").filter({ hasText: testEmail });
    await expect(updatedRow.getByText("停用", { exact: true })).toBeVisible();
  });

  test("可以將停用使用者重新啟用", async ({ page }) => {
    const testEmail = `test.reactivate.${Date.now()}@example.com`;

    await page.goto("/admin/users");

    // 新增並直接停用
    await page.getByText("新增使用者").click();
    const createDialog = page.getByRole("dialog");
    await createDialog.getByLabel("Email").fill(testEmail);
    await createDialog.getByLabel("姓名").fill("待重啟用戶");
    await createDialog.getByRole("button", { name: "新增" }).click();
    await expect(createDialog).not.toBeVisible();

    const row = page.getByRole("row").filter({ hasText: testEmail });
    await row.getByRole("button", { name: "編輯" }).click();
    let editDialog = page.getByRole("dialog");
    await editDialog.locator("select[name='isActive']").selectOption("false");
    await editDialog.getByRole("button", { name: "儲存" }).click();
    await expect(editDialog).not.toBeVisible();

    // 確認停用後，再重新啟用
    const deactivatedRow = page.getByRole("row").filter({ hasText: testEmail });
    await deactivatedRow.getByRole("button", { name: "編輯" }).click();
    editDialog = page.getByRole("dialog");
    await editDialog.locator("select[name='isActive']").selectOption("true");
    await editDialog.getByRole("button", { name: "儲存" }).click();
    await expect(editDialog).not.toBeVisible();

    const reactivatedRow = page.getByRole("row").filter({ hasText: testEmail });
    await expect(reactivatedRow.getByText("啟用", { exact: true })).toBeVisible();
  });
});
