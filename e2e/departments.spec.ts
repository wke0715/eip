import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

type Page = import("@playwright/test").Page;
type Locator = import("@playwright/test").Locator;

/** 用部門名稱取得對應的部門卡片 */
function deptCard(page: Page, name: string) {
  return page.locator(`[data-testid="dept-card-${name}"]`);
}

async function createUser(page: Page, email: string, name: string) {
  await page.getByText("新增使用者").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("姓名").fill(name);
  await dialog.getByRole("button", { name: "新增" }).click();
  await expect(dialog).not.toBeVisible();
}

async function createDept(page: Page, name: string) {
  await page.getByText("新增部門").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("部門名稱").fill(name);
  await dialog.getByRole("button", { name: "新增" }).click();
  await expect(dialog).not.toBeVisible();
}

async function addMember(card: Locator, userName: string) {
  await card.getByTitle("展開成員").click();
  await card.getByText("新增成員").click();
  await card.locator("select").selectOption({ label: userName });
}

async function createDeptWithMember(
  page: Page,
  deptPrefix: string,
  userPrefix: string,
  emailSlug: string,
) {
  const ts = Date.now();
  const deptName = `${deptPrefix}${ts}`;
  const userEmail = `dept.${emailSlug}.${ts}@example.com`;
  const userName = `${userPrefix}${ts}`;

  await page.goto("/admin/users");
  await createUser(page, userEmail, userName);
  await createDept(page, deptName);

  const card = deptCard(page, deptName);
  await addMember(card, userName);
  await expect(card.locator("li").filter({ hasText: userName })).toBeVisible();

  return { deptName, userName, card };
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
    await expect(
      dialog.getByRole("heading", { name: "新增部門" }),
    ).toBeVisible();
    await expect(dialog.getByLabel("部門名稱")).toBeVisible();
  });

  test("新增部門後出現在列表", async ({ page }) => {
    const deptName = `測試部門${Date.now()}`;
    await page.goto("/admin/users");
    await createDept(page, deptName);
    await expect(deptCard(page, deptName)).toBeVisible();
  });

  test("重複部門名稱顯示錯誤", async ({ page }) => {
    const deptName = `重複部門${Date.now()}`;
    await page.goto("/admin/users");

    await createDept(page, deptName);

    await page.getByText("新增部門").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("部門名稱").fill(deptName);
    await dialog.getByRole("button", { name: "新增" }).click();
    await expect(dialog.getByText("此部門名稱已存在")).toBeVisible();
  });

  test("可以展開部門查看成員區塊", async ({ page }) => {
    const deptName = `展開測試${Date.now()}`;
    await page.goto("/admin/users");
    await createDept(page, deptName);

    const card = deptCard(page, deptName);
    await card.getByTitle("展開成員").click();
    await expect(card.getByText("此部門尚無成員")).toBeVisible();
  });

  test("可以新增成員到部門", async ({ page }) => {
    await createDeptWithMember(page, "成員測試", "部門成員", "member");
  });

  test("可以移出部門成員", async ({ page }) => {
    const { userName, card } = await createDeptWithMember(page, "移出測試", "待移出", "remove");

    const memberRow = card.locator("li").filter({ hasText: userName });
    await memberRow.getByTitle("移出部門").click();

    await expect(
      card.locator("li").filter({ hasText: userName }),
    ).not.toBeVisible();
    await expect(card.getByText("此部門尚無成員")).toBeVisible();
  });

  test("可以設定部門主管", async ({ page }) => {
    const { deptName, userName, card } = await createDeptWithMember(page, "主管測試", "部門主管", "mgr");

    await card.getByTitle("編輯").click();
    const editDialog = page.getByRole("dialog");
    await expect(
      editDialog.getByRole("heading", { name: "編輯部門" }),
    ).toBeVisible();
    await editDialog
      .locator("select[name='managerId']")
      .selectOption({ label: userName });
    await editDialog.getByRole("button", { name: "儲存" }).click();
    await expect(editDialog).not.toBeVisible();

    await expect(
      page
        .locator(`[data-testid="dept-card-${deptName}"]`)
        .getByText(`主管：${userName}`),
    ).toBeVisible();
  });

  test("有成員時無法刪除部門", async ({ page }) => {
    const { card } = await createDeptWithMember(page, "刪除保護", "保護成員", "nodelete");

    await expect(card.getByTitle("請先移除所有成員")).toBeDisabled();
  });

  test("無成員時可以刪除部門", async ({ page }) => {
    const deptName = `可刪除${Date.now()}`;
    await page.goto("/admin/users");
    await createDept(page, deptName);
    await expect(deptCard(page, deptName)).toBeVisible();

    page.on("dialog", (d) => d.accept());
    await deptCard(page, deptName).getByTitle("刪除").click();

    await expect(deptCard(page, deptName)).not.toBeVisible();
  });
});
