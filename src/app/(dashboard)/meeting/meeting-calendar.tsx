"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { getMeetingBookingsForMonth } from "@/actions/meeting";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MeetingBookingDialog,
  type MeetingDialogTarget,
  type BookingForDialog,
} from "./meeting-booking-dialog";

// ── Types ─────────────────────────────────────────────────────────────

type Booking = Awaited<ReturnType<typeof getMeetingBookingsForMonth>>[number];
type Room = { id: string; name: string; location: string | null; capacity: number | null };
type User = { id: string; name: string | null; email: string };

// ── Color palette ─────────────────────────────────────────────────────

const COLORS = [
  { bg: "bg-blue-100",   text: "text-blue-900",   dot: "bg-blue-500",   border: "border-blue-200"   },
  { bg: "bg-purple-100", text: "text-purple-900",  dot: "bg-purple-500", border: "border-purple-200" },
  { bg: "bg-orange-100", text: "text-orange-900",  dot: "bg-orange-500", border: "border-orange-200" },
  { bg: "bg-green-100",  text: "text-green-900",   dot: "bg-green-500",  border: "border-green-200"  },
  { bg: "bg-red-100",    text: "text-red-900",     dot: "bg-red-500",    border: "border-red-200"    },
  { bg: "bg-yellow-100", text: "text-yellow-900",  dot: "bg-yellow-500", border: "border-yellow-200" },
  { bg: "bg-pink-100",   text: "text-pink-900",    dot: "bg-pink-500",   border: "border-pink-200"   },
  { bg: "bg-teal-100",   text: "text-teal-900",    dot: "bg-teal-500",   border: "border-teal-200"   },
];

function getRoomColor(roomId: string, roomIds: string[]) {
  const idx = roomIds.indexOf(roomId);
  return COLORS[(idx >= 0 ? idx : 0) % COLORS.length];
}

// ── Date utils ────────────────────────────────────────────────────────

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_ZH = [
  "1 月", "2 月", "3 月", "4 月", "5 月", "6 月",
  "7 月", "8 月", "9 月", "10 月", "11 月", "12 月",
];

function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function bookingDateKey(isoDate: string): string {
  // date is stored as UTC midnight, use UTC parts to get correct date
  const d = new Date(isoDate);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function isToday(year: number, month: number, day: number): boolean {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day;
}

// ── Component ─────────────────────────────────────────────────────────

interface Props {
  rooms: Room[];
  users: User[];
  currentUserId: string;
  isAdmin: boolean;
}

export function MeetingCalendar({ rooms, users, currentUserId, isAdmin }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [viewMode, setViewMode] = useState<"month" | "day">("month");
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [filterRoomId, setFilterRoomId] = useState("");
  const [filterBookerId, setFilterBookerId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dialogTarget, setDialogTarget] = useState<MeetingDialogTarget | null>(null);
  const [isPending, startTransition] = useTransition();

  const roomIds = rooms.map((r) => r.id);

  const fetchBookings = useCallback(() => {
    startTransition(async () => {
      const data = await getMeetingBookingsForMonth(year, month);
      setBookings(data);
    });
  }, [year, month]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // ── Filters ──────────────────────────────────────────

  const filtered = bookings.filter((b) => {
    if (filterRoomId && b.roomId !== filterRoomId) return false;
    if (filterBookerId && b.bookerId !== filterBookerId) return false;
    return true;
  });

  // Unique bookers derived from fetched bookings
  const bookers = Array.from(
    new Map(bookings.map((b) => [b.bookerId, b.booker])).values()
  );

  // ── Navigation ───────────────────────────────────────

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }
  function goToday() {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDay(now.getDate());
    setViewMode("month");
  }

  function openNewBooking(dateKey: string) {
    setDialogTarget({ mode: "new", date: dateKey });
  }

  function openViewBooking(booking: Booking) {
    setDialogTarget({ mode: "view", booking: booking as BookingForDialog });
  }

  // ── Calendar data ────────────────────────────────────

  const grid = getMonthGrid(year, month);

  const byDay = new Map<string, Booking[]>();
  filtered.forEach((b) => {
    const key = bookingDateKey(b.date as string);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(b);
  });

  const dayBookings = filtered
    .filter((b) => bookingDateKey(b.date as string) === toDateKey(year, month, selectedDay))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // ── Render ───────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">會議室</h1>
        <Link href="/meeting/book" className={buttonVariants()}>
          <Plus className="mr-1 h-4 w-4" />
          預約會議室
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">會議室</span>
          <select
            value={filterRoomId}
            onChange={(e) => setFilterRoomId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[180px]"
          >
            <option value="">所有會議室</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">發起人</span>
          <select
            value={filterBookerId}
            onChange={(e) => setFilterBookerId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[180px]"
          >
            <option value="">所有發起人</option>
            {bookers.map((u) => (
              <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goToday}>今天</Button>
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("month")}
          >月</Button>
          <Button
            variant={viewMode === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("day")}
          >日</Button>
          <Button variant="outline" size="icon-sm" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 副標題 */}
      <h2 className="text-xl font-semibold">
        {year} 年 {MONTH_ZH[month - 1]}
      </h2>

      {/* Month view */}
      {viewMode === "month" && (
        <div className={cn("border rounded-lg overflow-hidden", isPending && "opacity-60 pointer-events-none")}>
          {/* Weekday header */}
          <div className="grid grid-cols-7 bg-muted/50 border-b">
            {WEEKDAY_ZH.map((d, i) => (
              <div
                key={d}
                className={cn(
                  "py-2 text-center text-xs font-medium border-r last:border-r-0",
                  i === 0 && "text-red-500",
                  i === 6 && "text-blue-500",
                  "text-muted-foreground"
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {grid.map((day, i) => {
              const colIdx = i % 7;
              const dayKey = day ? toDateKey(year, month, day) : null;
              const dayEvents = dayKey ? (byDay.get(dayKey) ?? []) : [];
              const todayCell = day ? isToday(year, month, day) : false;
              const MAX_VISIBLE = 3;

              if (!day) {
                return <div key={`empty-${i}`} className="min-h-[120px] border-b border-r last:border-r-0 bg-muted/10 transition-colors" />;
              }

              return (
                <button
                  type="button"
                  key={dayKey!}
                  className="min-h-[120px] border-b border-r last:border-r-0 p-1 transition-colors cursor-pointer hover:bg-muted/20 text-left w-full"
                  onClick={() => dayKey && openNewBooking(dayKey)}
                  onKeyDown={(e) => {
                    if (dayKey && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      openNewBooking(dayKey);
                    }
                  }}
                >
                  <>
                      <div className={cn(
                        "w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-0.5 mx-auto",
                        todayCell && "bg-primary text-primary-foreground",
                        !todayCell && colIdx === 0 && "text-red-500",
                        !todayCell && colIdx === 6 && "text-blue-500",
                      )}>
                        {day}
                      </div>

                      <div className="space-y-0.5">
                        {dayEvents.slice(0, MAX_VISIBLE).map((b) => {
                          const color = getRoomColor(b.roomId, roomIds);
                          return (
                            <button
                              type="button"
                              key={b.id}
                              title={`[${b.room.name}] ${b.subject}\n${b.startTime}~${b.endTime}\n${b.booker.name ?? b.booker.email}`}
                              className={cn(
                                "w-full flex items-center gap-0.5 text-xs px-1 py-0.5 rounded border leading-tight cursor-pointer hover:opacity-80",
                                color.bg, color.text, color.border
                              )}
                              onClick={(e) => { e.stopPropagation(); openViewBooking(b); }}
                            >
                              <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", color.dot)} />
                              <span className="truncate">
                                {b.room.name} {b.startTime}~{b.endTime} {b.booker.name ?? b.booker.email}
                              </span>
                            </button>
                          );
                        })}
                        {dayEvents.length > MAX_VISIBLE && (
                          <div className="text-xs text-muted-foreground px-1">
                            +{dayEvents.length - MAX_VISIBLE} 筆
                          </div>
                        )}
                      </div>
                  </>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Day view */}
      {viewMode === "day" && (
        <div className={cn("border rounded-lg overflow-hidden", isPending && "opacity-60")}>
          <div className="border-b px-4 py-3 font-medium bg-muted/30">
            {year} 年 {month} 月 {selectedDay} 日 的預約
          </div>

          {dayBookings.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">當天沒有會議預約</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openNewBooking(toDateKey(year, month, selectedDay))}
              >
                <Plus className="h-4 w-4 mr-1" />
                新增預約
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              <div className="px-4 py-2 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openNewBooking(toDateKey(year, month, selectedDay))}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  新增預約
                </Button>
              </div>
              {dayBookings.map((b) => {
                const color = getRoomColor(b.roomId, roomIds);
                return (
                  <button
                    type="button"
                    key={b.id}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 cursor-pointer text-left"
                    onClick={() => openViewBooking(b)}
                  >
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", color.dot)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        【{b.room.name}】{b.subject}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {b.startTime}~{b.endTime} · {b.booker.name ?? b.booker.email}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <MeetingBookingDialog
        target={dialogTarget}
        rooms={rooms}
        users={users}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onClose={() => setDialogTarget(null)}
        onSaved={fetchBookings}
      />
    </div>
  );
}
