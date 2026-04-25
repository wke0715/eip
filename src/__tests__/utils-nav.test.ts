import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";
import { userNavItems, adminNavItems } from "@/lib/navigation";

describe("cn", () => {
  it("單一 class 應原樣回傳", () => {
    expect(cn("text-red-500")).toBe("text-red-500");
  });

  it("多個 class 應合併", () => {
    expect(cn("text-sm", "font-bold")).toBe("text-sm font-bold");
  });

  it("衝突的 Tailwind class 應以後者為準", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("falsy 值應被忽略", () => {
    expect(cn("text-sm", false, undefined, null, "font-bold")).toBe("text-sm font-bold");
  });

  it("條件式 class 物件應正確合併", () => {
    expect(cn({ "text-red-500": true, "text-blue-500": false })).toBe("text-red-500");
  });
});

describe("userNavItems", () => {
  it("應包含儀表板項目", () => {
    const dashboard = userNavItems.find((item) => item.href === "/");
    expect(dashboard).toBeDefined();
    expect(dashboard?.label).toBe("儀表板");
  });

  it("應包含至少 5 個導覽項目", () => {
    expect(userNavItems.length).toBeGreaterThanOrEqual(5);
  });

  it("每個項目都應有 label、href 和 icon", () => {
    for (const item of userNavItems) {
      expect(item.label).toBeTruthy();
      expect(item.href).toBeTruthy();
      expect(item.icon).toBeDefined();
    }
  });
});

describe("adminNavItems", () => {
  it("應包含人員管理項目", () => {
    const users = adminNavItems.find((item) => item.href === "/admin/users");
    expect(users).toBeDefined();
  });

  it("應包含至少 3 個導覽項目", () => {
    expect(adminNavItems.length).toBeGreaterThanOrEqual(3);
  });

  it("每個項目都應有 label、href 和 icon", () => {
    for (const item of adminNavItems) {
      expect(item.label).toBeTruthy();
      expect(item.href).toBeTruthy();
      expect(item.icon).toBeDefined();
    }
  });
});
