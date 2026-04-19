import { Page } from "@playwright/test";

interface BookingOptions {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  roomId?: string;
}

export async function fillBookingForm(
  page: Page,
  { date, startTime, endTime, title, roomId = "test-room-id" }: BookingOptions,
) {
  await page.locator('select[name="roomId"]').selectOption({ value: roomId });
  await page.getByLabel("日期").fill(date);
  await page.locator('select[name="startTime"]').selectOption(startTime);
  await page.locator('select[name="endTime"]').selectOption(endTime);
  await page.getByLabel("會議主題").fill(title);
}

export async function bookMeeting(page: Page, opts: BookingOptions) {
  await page.goto("/meeting/book");
  await fillBookingForm(page, opts);
  await page.getByRole("button", { name: "確認預約" }).click();
}
