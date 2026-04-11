/**
 * 將 "HH:mm" 格式轉為分鐘數
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * 檢查兩個時段是否重疊
 */
export function isTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a0 = timeToMinutes(startA);
  const a1 = timeToMinutes(endA);
  const b0 = timeToMinutes(startB);
  const b1 = timeToMinutes(endB);

  return a0 < b1 && b0 < a1;
}

/**
 * 產生 30 分鐘粒度的時段選項（"08:00" ~ "18:00"）
 */
export function generateTimeSlots(
  startHour = 8,
  endHour = 18,
  interval = 30
): string[] {
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += interval) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  slots.push(`${String(endHour).padStart(2, "0")}:00`);
  return slots;
}
