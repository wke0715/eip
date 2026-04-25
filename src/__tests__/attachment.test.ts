import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetMaxAttachmentSizeMb = vi.hoisted(() => vi.fn());

vi.mock("@/lib/settings", () => ({
  getMaxAttachmentSizeMb: mockGetMaxAttachmentSizeMb,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { upsertAttachment } from "@/lib/attachment";

function makeTx() {
  return {
    formAttachment: { upsert: vi.fn().mockResolvedValue({}) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMaxAttachmentSizeMb.mockResolvedValue(10);
});

describe("upsertAttachment", () => {
  it("無附件應直接返回（不呼叫 upsert）", async () => {
    const fd = new FormData();
    const tx = makeTx();
    await upsertAttachment(tx as never, "sub-1", fd);
    expect(tx.formAttachment.upsert).not.toHaveBeenCalled();
  });

  it("空 File（size=0）應直接返回", async () => {
    const fd = new FormData();
    fd.append("attachment", new File([], "empty.txt", { type: "text/plain" }));
    const tx = makeTx();
    await upsertAttachment(tx as never, "sub-1", fd);
    expect(tx.formAttachment.upsert).not.toHaveBeenCalled();
  });

  it("檔案超過上限應拋出錯誤", async () => {
    mockGetMaxAttachmentSizeMb.mockResolvedValue(1);
    const largeContent = new Uint8Array(2 * 1024 * 1024); // 2MB
    const fd = new FormData();
    fd.append(
      "attachment",
      new File([largeContent], "big.pdf", { type: "application/pdf" }),
    );
    const tx = makeTx();
    await expect(upsertAttachment(tx as never, "sub-1", fd)).rejects.toThrow(
      "附件超過 1 MB 上限",
    );
  });

  it("合法附件應呼叫 upsert", async () => {
    mockGetMaxAttachmentSizeMb.mockResolvedValue(10);
    const fd = new FormData();
    fd.append(
      "attachment",
      new File(["hello"], "doc.pdf", { type: "application/pdf" }),
    );
    const tx = makeTx();
    await upsertAttachment(tx as never, "sub-1", fd);
    expect(tx.formAttachment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { submissionId: "sub-1" } }),
    );
  });
});
