"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { getCalendarEvents, getCalendarPersonNames } from "@/actions/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Upload, Download } from "lucide-react";
import { ImportDialog } from "./import-dialog";
import { CalendarEditDialog, type EditTarget } from "./calendar-edit-dialog";
import type { CalendarEventStatus } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type CalEvent = {
  id: string;
  date: string; // serialized as ISO string from Server Action
  personName: string;
  amTask: string | null;
  pmTask: string | null;
  fullDayTask: string | null;
  status: CalendarEventStatus;
  isHoliday: boolean;
  weekNumber: number | null;
};

type ClientEvent = {
  id: string;
  date: string;
  event: string;
};

// ─── Status styling ───────────────────────────────────────────────────────────

const STATUS_CHIP: Record<CalendarEventStatus, string> = {
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200",
  TENTATIVE: "bg-pink-100 text-pink-800 border-pink-200",
  COMPLETED: "bg-gray-100 text-gray-600 border-gray-300",
  HOLIDAY:   "bg-red-100  text-red-700  border-red-200",
};

const STATUS_LABEL: Record<CalendarEventStatus, string> = {
  CONFIRMED: "已確認",
  TENTATIVE: "未定",
  COMPLETED: "完成",
  HOLIDAY:   "假日",
};

// ─── Person colors ────────────────────────────────────────────────────────────

const PERSON_DOT = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500",
  "bg-orange-500", "bg-teal-500", "bg-yellow-500",
];

function personDot(name: string, names: string[]) {
  const idx = names.indexOf(name);
  return PERSON_DOT[(idx >= 0 ? idx : 0) % PERSON_DOT.length];
}

// ─── Date utilities ───────────────────────────────────────────────────────────

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_ZH = [
  "1 月", "2 月", "3 月", "4 月", "5 月", "6 月",
  "7 月", "8 月", "9 月", "10 月", "11 月", "12 月",
];

/** Local date → "YYYY-MM-DD" */
function dateToKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** DB ISO string → "YYYY-MM-DD"（@db.Date stores as UTC midnight） */
function isoToKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

/** 產生月曆 grid（null = 空白格）*/
function getMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (Date | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month - 1, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** 取得 anchor 日期所在週的 Mon ~ Sun */
function getWeekDays(anchor: Date): Date[] {
  const dow = anchor.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow; // 對齊到週一
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  initialPersonNames: string[];
}

export function CalendarView({ initialPersonNames }: Props) {
  const today = new Date();
  const [year, setYear]               = useState(today.getFullYear());
  const [month, setMonth]             = useState(today.getMonth() + 1);
  const [viewMode, setViewMode]       = useState<"month" | "week">("month");
  const [weekAnchor, setWeekAnchor]   = useState(today);
  const [selectedPerson, setSelectedPerson] = useState("");
  const [events, setEvents]           = useState<CalEvent[]>([]);
  const [clientEvents, setClientEvents] = useState<ClientEvent[]>([]);
  const [personNames, setPersonNames] = useState<string[]>(initialPersonNames);
  const [importOpen, setImportOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<EditTarget | null>(null);
  const [highlightToday, setHighlightToday] = useState(false);
  const [isPending, startTransition]  = useTransition();

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(() => {
    startTransition(async () => {
      // 決定要 fetch 哪幾個月（週視圖可能跨月）
      const monthsToFetch = new Map<string, { year: number; month: number }>();
      const addMonth = (y: number, m: number) => monthsToFetch.set(`${y}-${m}`, { year: y, month: m });

      if (viewMode === "week") {
        getWeekDays(weekAnchor).forEach(d => addMonth(d.getFullYear(), d.getMonth() + 1));
      } else {
        addMonth(year, month);
      }

      const allEvents: CalEvent[] = [];
      const allClientEvents: ClientEvent[] = [];
      const seenEv = new Set<string>();
      const seenCl = new Set<string>();

      await Promise.all(
        [...monthsToFetch.values()].map(async (m) => {
          const data = await getCalendarEvents({
            year: m.year,
            month: m.month,
            personName: selectedPerson || undefined,
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const e of data.events as any[]) {
            if (!seenEv.has(e.id)) { seenEv.add(e.id); allEvents.push(e); }
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const e of data.clientEvents as any[]) {
            if (!seenCl.has(e.id)) { seenCl.add(e.id); allClientEvents.push(e); }
          }
        })
      );

      setEvents(allEvents);
      setClientEvents(allClientEvents);
    });
  }, [year, month, viewMode, weekAnchor, selectedPerson]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 匯入後同時重整人員名單
  async function handleImportSuccess() {
    const names = await getCalendarPersonNames();
    setPersonNames(names);
    fetchAll();
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function prevPeriod() {
    if (viewMode === "month") {
      if (month === 1) { setYear(y => y - 1); setMonth(12); }
      else setMonth(m => m - 1);
    } else {
      const d = new Date(weekAnchor);
      d.setDate(d.getDate() - 7);
      setWeekAnchor(d);
      setYear(d.getFullYear());
      setMonth(d.getMonth() + 1);
    }
  }

  function nextPeriod() {
    if (viewMode === "month") {
      if (month === 12) { setYear(y => y + 1); setMonth(1); }
      else setMonth(m => m + 1);
    } else {
      const d = new Date(weekAnchor);
      d.setDate(d.getDate() + 7);
      setWeekAnchor(d);
      setYear(d.getFullYear());
      setMonth(d.getMonth() + 1);
    }
  }

  function goToday() {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setWeekAnchor(now);
    setHighlightToday(true);
    setTimeout(() => setHighlightToday(false), 1200);
  }

  // ── Lookup maps ────────────────────────────────────────────────────────────

  const eventsByDay = new Map<string, CalEvent[]>();
  events.forEach(e => {
    const k = isoToKey(e.date);
    if (!eventsByDay.has(k)) eventsByDay.set(k, []);
    eventsByDay.get(k)!.push(e);
  });

  const clientByDay = new Map<string, ClientEvent[]>();
  clientEvents.forEach(e => {
    const k = isoToKey(e.date);
    if (!clientByDay.has(k)) clientByDay.set(k, []);
    clientByDay.get(k)!.push(e);
  });

  // ── Week data ──────────────────────────────────────────────────────────────

  const weekDays = getWeekDays(weekAnchor);
  const weekNum = (() => {
    for (const d of weekDays) {
      const evs = eventsByDay.get(dateToKey(d)) ?? [];
      const found = evs.find(e => e.weekNumber);
      if (found) return found.weekNumber;
    }
    return null;
  })();

  const displayPersons = selectedPerson ? [selectedPerson] : personNames;

  // ── Click handlers（抽出以避免巢狀過深 + 支援鍵盤觸發）────────────────────
  function openNewForDay(dayKey: string) {
    setEditTarget({
      date: dayKey,
      personName: selectedPerson,
      amTask: null,
      pmTask: null,
      fullDayTask: null,
      status: "CONFIRMED",
      weekNumber: null,
    });
  }

  function openEditForEvent(eventId: string, dayKey: string) {
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;
    setEditTarget({
      date: dayKey,
      personName: ev.personName,
      amTask: ev.amTask,
      pmTask: ev.pmTask,
      fullDayTask: ev.fullDayTask,
      status: ev.status,
      weekNumber: ev.weekNumber,
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">人員行事曆</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { window.location.href = `/api/calendar/export?year=${year}`; }}
          >
            <Download className="h-4 w-4 mr-1.5" />
            匯出 Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" />
            匯入 Excel
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 人員篩選 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">人員</span>
          <select
            value={selectedPerson}
            onChange={e => setSelectedPerson(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[120px]"
          >
            <option value="">全員</option>
            {personNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* 月/週切換 + 導覽 */}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goToday}>今天</Button>
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("month")}
          >月</Button>
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("week")}
          >週</Button>
          <Button variant="outline" size="icon-sm" onClick={prevPeriod}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={nextPeriod}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 標題 */}
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">
          {viewMode === "month"
            ? `${year} 年 ${MONTH_ZH[month - 1]}`
            : `${year} 年 W${weekNum ? String(weekNum).padStart(2, "0") : "—"}（${MONTH_ZH[weekDays[0].getMonth()]} ${weekDays[0].getDate()} 日 ～ ${MONTH_ZH[weekDays[6].getMonth()]} ${weekDays[6].getDate()} 日）`
          }
        </h2>
      </div>

      {/* 狀態圖例 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(["CONFIRMED", "TENTATIVE", "COMPLETED", "HOLIDAY"] as CalendarEventStatus[]).map(s => (
          <span key={s} className={cn("px-2 py-0.5 rounded border", STATUS_CHIP[s])}>
            {STATUS_LABEL[s]}
          </span>
        ))}
        <span className="px-2 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200">
          客戶行事曆
        </span>
      </div>

      {/* ── 月視圖 ── */}
      {viewMode === "month" && (
        <div className={cn("border rounded-lg overflow-hidden", isPending && "opacity-60 pointer-events-none")}>
          {/* 星期標頭 */}
          <div className="grid grid-cols-7 bg-muted/50 border-b">
            {WEEKDAY_ZH.map((d, i) => (
              <div key={d} className={cn(
                "py-2 text-center text-xs font-medium border-r last:border-r-0 text-muted-foreground",
                i === 0 && "text-red-500",
                i === 6 && "text-blue-500",
              )}>
                {d}
              </div>
            ))}
          </div>

          {/* 日格 */}
          <div className="grid grid-cols-7">
            {getMonthGrid(year, month).map((day, i) => {
              const colIdx = i % 7;
              const dayKey = day ? dateToKey(day) : null;
              const dayEvents = dayKey ? (eventsByDay.get(dayKey) ?? []) : [];
              const dayClientEvents = dayKey ? (clientByDay.get(dayKey) ?? []) : [];
              const hasHoliday = dayEvents.some(e => e.isHoliday);
              const todayCell = day ? isToday(day) : false;

              // 合併 client events + person events 成顯示用 chips（最多 4 筆）
              type Chip =
                | { kind: "client"; id: string; label: string }
                | { kind: "person"; id: string; label: string; status: CalendarEventStatus; name: string };

              const chips: Chip[] = [
                ...dayClientEvents.map(e => ({
                  kind: "client" as const,
                  id: e.id,
                  label: e.event,
                })),
                ...dayEvents.map(e => ({
                  kind: "person" as const,
                  id: e.id,
                  label: `${e.personName}: ${e.fullDayTask ?? e.amTask ?? e.pmTask ?? ""}`,
                  status: e.status,
                  name: e.personName,
                })),
              ];

              return (
                <div
                  key={dayKey ?? `empty-${i}`}
                  role={day ? "button" : undefined}
                  tabIndex={day ? 0 : -1}
                  onClick={() => { if (dayKey) openNewForDay(dayKey); }}
                  onKeyDown={(e) => {
                    if (dayKey && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      openNewForDay(dayKey);
                    }
                  }}
                  className={cn(
                    "min-h-[110px] border-b border-r last:border-r-0 p-1",
                    day && "cursor-pointer hover:bg-muted/10",
                    !day && "bg-muted/10",
                    hasHoliday && day && "bg-red-50/40",
                  )}
                >
                  {day && (
                    <>
                      <div className={cn(
                        "w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-0.5 mx-auto transition-all",
                        todayCell && "bg-primary text-primary-foreground",
                        todayCell && highlightToday && "ring-4 ring-primary/40 scale-125",
                        !todayCell && colIdx === 0 && "text-red-500",
                        !todayCell && colIdx === 6 && "text-blue-500",
                      )}>
                        {day.getDate()}
                      </div>

                      <div className="space-y-0.5">
                        {chips.map(chip => {
                          if (chip.kind === "client") {
                            return (
                              <div
                                key={chip.id}
                                title={chip.label}
                                className="text-xs px-1 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200 leading-tight truncate"
                              >
                                {chip.label}
                              </div>
                            );
                          }
                          return (
                            <button
                              type="button"
                              key={chip.id}
                              title={`${chip.label}（點擊編輯）`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (dayKey) openEditForEvent(chip.id, dayKey);
                              }}
                              className={cn(
                                "w-full flex items-center gap-0.5 text-xs px-1 py-0.5 rounded border leading-tight cursor-pointer hover:opacity-80",
                                STATUS_CHIP[chip.status]
                              )}
                            >
                              <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", personDot(chip.name, personNames))} />
                              <span className="truncate">{chip.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 週視圖 ── */}
      {viewMode === "week" && (
        <div className={cn("border rounded-lg overflow-auto", isPending && "opacity-60")}>
          <table className="w-full text-sm border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="w-[80px] px-2 py-2 text-left text-xs font-medium text-muted-foreground border-r">人員</th>
                {weekDays.map(d => {
                  const dow = d.getDay();
                  const todayCell = isToday(d);
                  return (
                    <th key={dateToKey(d)} className="px-1 py-2 text-center border-r last:border-r-0">
                      <div className={cn(
                        "text-xs text-muted-foreground",
                        dow === 0 && "text-red-500",
                        dow === 6 && "text-blue-500",
                      )}>
                        {WEEKDAY_ZH[dow]}
                      </div>
                      <div className={cn(
                        "inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium transition-all",
                        todayCell && "bg-primary text-primary-foreground",
                        todayCell && highlightToday && "ring-4 ring-primary/40 scale-125",
                        !todayCell && dow === 0 && "text-red-500",
                        !todayCell && dow === 6 && "text-blue-500",
                      )}>
                        {d.getDate()}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* 客戶行事曆 */}
              <tr className="border-b bg-amber-50/30">
                <td className="px-2 py-2 text-xs font-medium text-muted-foreground border-r align-top whitespace-nowrap">
                  客戶
                </td>
                {weekDays.map(d => {
                  const key = dateToKey(d);
                  const ces = clientByDay.get(key) ?? [];
                  return (
                    <td key={key} className="px-1 py-1 border-r last:border-r-0 align-top min-h-[50px]">
                      <div className="space-y-0.5">
                        {ces.map(e => (
                          <div
                            key={e.id}
                            title={e.event}
                            className="text-xs px-1 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200 leading-tight truncate"
                          >
                            {e.event}
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* 各人員 */}
              {displayPersons.map(person => (
                <tr key={person} className="border-b last:border-b-0 hover:bg-muted/10">
                  <td className="px-2 py-2 text-xs font-medium border-r align-top whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("inline-block w-2 h-2 rounded-full", personDot(person, personNames))} />
                      {person}
                    </div>
                  </td>
                  {weekDays.map(d => {
                    const key = dateToKey(d);
                    const ev = (eventsByDay.get(key) ?? []).find(e => e.personName === person);

                    return (
                      <td
                        key={key}
                        title="點擊編輯"
                        onClick={() => setEditTarget({
                          date: key,
                          personName: person,
                          amTask: ev?.amTask ?? null,
                          pmTask: ev?.pmTask ?? null,
                          fullDayTask: ev?.fullDayTask ?? null,
                          status: ev?.status ?? "CONFIRMED",
                          weekNumber: ev?.weekNumber ?? null,
                        })}
                        className={cn(
                          "px-1 py-1 border-r last:border-r-0 align-top cursor-pointer hover:bg-muted/20",
                          ev?.isHoliday && "bg-red-50/40",
                        )}
                      >
                        {ev && (
                          <div className="space-y-0.5">
                            {ev.amTask && (
                              <div className={cn("text-xs px-1 py-0.5 rounded border leading-tight truncate", STATUS_CHIP[ev.status])} title={ev.amTask}>
                                <span className="text-[10px] opacity-70">上午 </span>{ev.amTask}
                              </div>
                            )}
                            {ev.pmTask && (
                              <div className={cn("text-xs px-1 py-0.5 rounded border leading-tight truncate", STATUS_CHIP[ev.status])} title={ev.pmTask}>
                                <span className="text-[10px] opacity-70">下午 </span>{ev.pmTask}
                              </div>
                            )}
                            {ev.fullDayTask && (
                              <div className={cn("text-xs px-1 py-0.5 rounded border leading-tight truncate", STATUS_CHIP[ev.status])} title={ev.fullDayTask}>
                                {ev.fullDayTask}
                              </div>
                            )}
                            {ev.isHoliday && !ev.amTask && !ev.pmTask && !ev.fullDayTask && (
                              <div className="text-xs px-1 py-0.5 rounded border bg-red-100 text-red-700 border-red-200 leading-tight">
                                假日
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* 沒有資料時的提示 */}
              {displayPersons.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    尚無人員資料，請先匯入 Excel
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={handleImportSuccess}
      />

      <CalendarEditDialog
        target={editTarget}
        personNames={personNames}
        onClose={() => setEditTarget(null)}
        onSaved={fetchAll}
      />
    </div>
  );
}
