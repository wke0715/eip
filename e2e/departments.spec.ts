import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/** 用部門名稱取得對應的部門卡片 */
function deptCard(page: import("@playwright/test").Page, name: string) {
  return page.locator(`[data-testid="dept-card-${name}"]`);
}

// 部門管理功能尚未實作（無 Prisma schema、無頁面），暫時跳過
test.describe.skip("部門管理", () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, "ADMIN");
  });

  test("頁面顯示部門管理區塊", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "部門管理" })).toBeVisible();
    await expect(page.getByText("新增部門")).toBeVisible();
  });

  test("可以開啟新增部門 Dialog", async ({ page }) => {
    await page.goto("/admin/users");
    await page.getByText("新增部門").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "新增部門" })).toBeVisible();
    await expect(dialog.getByLabel("部門名稱")).toBeVisible();
  });

  test("新增部門後出現在列表", async ({ page }) => {
    const deptName = `測試部門${Date.now()}`;
    await page.goto("/admin/users");
    await page.getByText("新增部門").click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("部門名稱").fill(deptName);
    await dialog.getByRole("button", { name: "新增" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(deptCard(page, deptName)).toBeVisible();
  });

  test("重複部門名稱顯示錯誤", async ({ page }) => {
    const deptName = `重複部門${Date.now()}`;
    await page.goto("/admin/users");

    await page.getByText("新增部門").click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("部門名稱").fill(deptName);
    await dialog.getByRole("button", { name: "新增" }).click();
    await expect(dialog).not.toBeVisible();

    await page.getByText("新增部門").click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("部門名稱").fill(deptName);
    await dialog.getByRole("button", { name: "新增" }).click();
    await expect(dialog.getByText("此部門名稱已存在")).toBeVisible();
  });

  test("可以展開部門查看成員區塊", async ({ page }) => {
    const deptName = `展開測試${Date.now()}`;
    await page.goto("/admin/users");

    await page.getByText("新增部門").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("部門名稱").fill(deptName);
    await dialog.getByRole("button", { name: "新增" }).click();
    await expect(dialog).not.toBeVisible();

    const card = deptCard(page, deptName);
    await card.getByTitle("展開成員").click();
    await expect(card.getByText("此部門尚無成員")).toBeVisible();
  });

  test("可以新增成員到部門", async ({ page }) => {
    const ts = Date.now();
    const deptName = `成員測試${ts}`;
    const userEmail = `dept.member.${ts}@example.com`;
    const userName = `部門成員${ts}`;

    await page.goto("/admin/users");

    // 建立使用者
    await page.getByText("新增使用者").click();
    const userDialog = page.getByRole("dialog");
    await userDialog.getByLabel("Email").fill(userEmail);
    await userDialog.getByLabel("姓名").fill(userName);
    await userDialog.getByRole("button", { name: "新增" }).click();
    await expect(userDialog).not.toBeVisible();

    // 建立部門
    await page.getByText("新增部門").click();
    const deptDialog = page.getByRole("dialog");
    await deptDialog.getByLabel("部門名稱").fill(deptName);
    await deptDialog.getByRole("button", { name: "新增" }).click();
    await expect(deptDialog).not.toBeVisible();

    // 展開並新增成員
    const card = deptCard(page, deptName);
    await card.getByTitle("展開成員").click();
    await card.getByText("新增成員").click();
    await card.locator("select").selectOption({ label: userName });

    // 成員出現在卡片的 li 清單
    await expect(card.locator("li").filter({ hasText: userName })).toBeVisible();
  });

  test("可以移出部門成員", async ({ page }) => {
    const ts = Date.now();
    const deptName = `移出測試${ts}`;
    const userEmail = `dept.remove.${ts}@example.com`;
    const userName = `待移出${ts}`;

    await page.goto("/admin/users");

    // 建立使用者
    await page.getByText("新增使用者").click();
    const userDialog = page.getByRole("dialog");
    await userDialog.getByLabel("Email").fill(userEmail);
    await userDialog.getByLabel("姓名").fill(userName);
    await userDialog.getByRole("button", { name: "新增" }).click();
    await expect(userDialog).not.toBeVisible();

    // 建立部門並加入成員
    await page.getByText("新增部門").click();
    const deptDialog = page.getByRole("dialog");
    await deptDialog.getByLabel("部門名稱").fill(deptName);
    await deptDialog.getByRole("button", { name: "新增" }).click();
    await expect(deptDialog).not.toBeVisible();

    const card = deptCard(page, deptName);
    await card.getByTitle("展開成員").click();
    await card.getByText("新增成員").click();
    await card.locator("select").selectOption({ label: userName });
    await expect(card.locator("li").filter({ hasText: userName })).toBeVisible();

    // 移出成員
    const memberRow = card.locator("li").filter({ hasText: userName });
    await memberRow.getByTitle("移出部門").click();

    await expect(card.locator("li").filter({ hasText: userName })).not.toBeVisible();
    await expect(card.getByText("此部門尚無成員")).toBeVisible();
  });

  test("可以設定部門主管", async ({ page }) => {
    const ts = Date.now();
    const deptName = `主管測試${ts}`;
    const userEmail = `dept.mgr.${ts}@example.com`;
    const userName = `部門主管${ts}`;

    await page.goto("/admin/users");

    // 建立使用者
    await page.getByText("新增使用者").click();
    const userDialog = page.getByRole("dialog");
    await userDialog.getByLabel("Email").fill(userEmail);
    await userDialog.getByLabel("姓名").fill(userName);
    await userDialog.getByRole("button", { name: "新增" }).click();
    await expect(userDialog).not.toBeVisible();

    // 建立部門並加入成員
    await page.getByText("新增部門").click();
    const deptDialog = page.getByRole("dialog");
    await deptDialog.getByLabel("部門名稱").fill(deptName);
    await deptDialog.getByRole("button", { name: "新增" }).click();
    await expect(deptDialog).not.toBeVisible();

    const card = deptCard(page, deptName);
    await card.getByTitle("展開成員").click();
    await card.getByText("新增成員").click();
    await card.locator("select").selectOption({ label: userName });
    await expect(card.locator("li").filter({ hasText: userName })).toBeVisible();

    // 編輯部門，設定主管
    await card.getByTitle("編輯").click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByRole("heading", { name: "編輯部門" })).toBeVisible();
    await editDialog.locator("select[name='managerId']").selectOption({ label: userName });
    await editDialog.getByRole("button", { name: "儲存" }).click();
    await expect(editDialog).not.toBeVisible();

    // 卡片顯示主管 badge
    await expect(page.locator(`[data-testid="dept-card-${deptName}"]`).getByText(`主管：${userName}`)).toBeVisible();
  });

  test("有成員時無法刪除部門", async ({ page }) => {
    const ts = Date.now();
    const deptName = `刪除保護${ts}`;
    const userEmail = `dept.nodelete.${ts}@example.com`;
    const userName = `保護成員${ts}`;

    await page.goto("/admin/users");

    await page.getByText("新增使用者").click();
    const userDialog = page.getByRole("dialog");
    await userDialog.getByLabel("Email").fill(userEmail);
    await userDialog.getByLabel("姓名").fill(userName);
    await userDialog.getByRole("button", { name: "新增" }).click();
    await expect(userDialog).not.toBeVisible();

    await page.getByText("新增部門").click();
    const deptDialog = page.getByRole("dialog");
    await deptDialog.getByLabel("部門名稱").fill(deptName);
    await deptDialog.getByRole("button", { name: "新增" }).click();
    await expect(deptDialog).not.toBeVisible();

    const card = deptCard(page, deptName);
    await card.getByTitle("展開成員").click();
    await card.getByText("新增成員").click();
    await card.locator("select").selectOption({ label: userName });
    await expect(card.locator("li").filter({ hasText: userName })).toBeVisible();

    // 刪除按鈕應為 disabled
    await expect(card.getByTitle("請先移除所有成員")).toBeDisabled();
  });

  test("無成員時可以刪除部門", async ({ page }) => {
    const deptName = `可刪除${Date.now()}`;
    await page.goto("/admin/users");

    await page.getByText("新增部門").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("部門名稱").fill(deptName);
    await dialog.getByRole("button", { name: "新增" }).click();
    await expect(dialog).not.toBeVisible();

    await expect(deptCard(page, deptName)).toBeVisible();

    page.on("dialog", (d) => d.accept());
    await deptCard(page, deptName).getByTitle("刪除").click();

    await expect(deptCard(page, deptName)).not.toBeVisible();
  });
});
