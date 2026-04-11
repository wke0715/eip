/**
 * 計算兩個日期之間的工作天數（跳過週末）
 * 起始日與結束日都計入
 */
export function calculateWorkingDays(start: Date, end: Date): number {
  if (end < start) return 0;

  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * 計算請假時數（工作天 * 8 小時）
 */
export function calculateLeaveHours(start: Date, end: Date): number {
  return calculateWorkingDays(start, end) * 8;
}
