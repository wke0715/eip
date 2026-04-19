import { Page } from "@playwright/test";

interface LeaveFormOptions {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export async function fillLeaveForm(
  page: Page,
  { leaveType, startDate, endDate, reason }: LeaveFormOptions
) {
  await page.getByLabel("假別").selectOption({ label: leaveType });
  await page.getByLabel("起始日期").fill(startDate);
  await page.getByLabel("結束日期").fill(endDate);
  await page.getByLabel("請假事由").fill(reason);
}

export async function submitLeave(page: Page, opts: LeaveFormOptions) {
  await page.goto("/leave/new");
  await fillLeaveForm(page, opts);
  await page.getByRole("button", { name: "送出請假單" }).click();
}
