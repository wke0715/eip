import Link from "next/link";
import { auth } from "@/lib/auth";
import { getDashboardStats } from "@/actions/notification";
import { getInboxItems } from "@/actions/approval";
import { DashboardCards } from "./dashboard-cards";
import { PendingApprovalList } from "./pending-approval-list";

function getTaipeiDate() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const tw = new Date(utc + 8 * 3600000);
  const DOW = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const DOW_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const MONTHS_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return {
    year:  tw.getFullYear(),
    month: String(tw.getMonth() + 1).padStart(2, "0"),
    day:   String(tw.getDate()).padStart(2, "0"),
    dow:   DOW[tw.getDay()],
    hour:  tw.getHours(),
    monthEn: MONTHS_EN[tw.getMonth()],
    dowEn: DOW_EN,
    date:  tw,
  };
}

function getGreeting(hour: number): string {
  if (hour < 12) return "早安";
  if (hour < 18) return "午安";
  return "晚安";
}

function getIssueNum(date: Date): number {
  const epoch = new Date("2024-01-01");
  return Math.floor((date.getTime() - epoch.getTime()) / 86400000) + 1;
}

function getWeekDays(date: Date): Array<{ dow: string; num: number; isToday: boolean }> {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const tw = new Date(utc + 8 * 3600000);
  const day = tw.getDay(); // 0=Sun
  // Monday-based week
  const monday = new Date(tw);
  monday.setDate(tw.getDate() - ((day + 6) % 7));
  const DOW_EN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  return DOW_EN.map((d, i) => {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    return {
      dow: d,
      num: cur.getDate(),
      isToday: cur.toDateString() === tw.toDateString(),
    };
  });
}

function getWeekNum(date: Date): number {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const tw = new Date(utc + 8 * 3600000);
  const start = new Date(tw.getFullYear(), 0, 1);
  return Math.ceil(((tw.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

const sectionHeadStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  marginBottom: "20px",
  borderBottom: "1px solid var(--line)",
  paddingBottom: "12px",
};

const composeActions = [
  { num: "01 / FORM", en: "A leave request",   zh: "請假單",  href: "/leave/new" },
  { num: "02 / FORM", en: "A trip claim",       zh: "差旅費",  href: "/expense/new" },
  { num: "03 / FORM", en: "An overtime slip",   zh: "加班單",  href: "/overtime/new" },
  { num: "04 / FORM", en: "Misc. expense",      zh: "其他費用", href: "/other-expense/new" },
];

export default async function DashboardPage() {
  const [session, stats, inbox] = await Promise.all([
    auth(),
    getDashboardStats(),
    getInboxItems(),
  ]);

  const dt = getTaipeiDate();
  const greeting = getGreeting(dt.hour);
  const displayName = session?.user?.name ?? "您";
  const issueNum = getIssueNum(dt.date);
  const weekDays = getWeekDays(dt.date);
  const weekNum = getWeekNum(dt.date);
  const pending = inbox.pendingApprovals ?? [];

  const pendingLabel = stats.pendingCount === 0
    ? "今日無代簽核事項。"
    : `共有 ${stats.pendingCount} 件事待您過目。`;

  return (
    <div style={{ maxWidth: "1280px" }}>

      {/* ── Masthead ─────────────────────────────── */}
      <header
        className="editorial-reveal editorial-d1"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "end",
          borderBottom: "1px solid var(--line-strong)",
          paddingBottom: "28px",
          marginBottom: "48px",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--bronze)",
              marginBottom: "18px",
            }}
          >
            <span
              className="editorial-pulse"
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--vermillion)",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span>{dt.year} · {dt.month} · {dt.day} · {dt.dow}</span>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(40px, 5vw, 72px)",
              fontWeight: 300,
              lineHeight: 0.95,
              letterSpacing: "-0.025em",
            }}
          >
            {greeting},{" "}
            <em style={{ fontStyle: "italic", fontWeight: 500, color: "var(--bronze)" }}>
              {displayName}
            </em>
            。<br />
            {pendingLabel}
          </h1>
        </div>
        <div
          style={{
            textAlign: "right",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--ink-soft)",
            lineHeight: 1.7,
            letterSpacing: "0.05em",
          }}
        >
          <div>EDITION <span style={{ color: "var(--ink)", fontWeight: 500 }}>VOL. XII</span></div>
          <div>ISSUE <span style={{ color: "var(--ink)", fontWeight: 500 }}>№ {issueNum}</span></div>
          <div>SEAL <span style={{ color: "var(--ink)", fontWeight: 500 }}>企盉顧問</span></div>
        </div>
      </header>

      {/* ── Quartet stats ────────────────────────── */}
      <DashboardCards
        pendingCount={stats.pendingCount}
        inProgressCount={stats.inProgressCount}
        approvedCount={stats.approvedCount}
        rejectedCount={stats.rejectedCount}
      />

      {/* ── Poetic interlude ─────────────────────── */}
      <section
        className="editorial-reveal editorial-d3"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr 1fr",
          gap: "40px",
          alignItems: "start",
          marginBottom: "56px",
        }}
      >
        <div />
        <blockquote className="editorial-drop-cap"
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "22px",
            fontStyle: "italic",
            fontWeight: 300,
            lineHeight: 1.5,
            color: "var(--ink-soft)",
          }}
        >
          盉者，調味之器。和五味，齊水火 — 一日之始，先理瑣事，方能心無旁騖。
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--bronze)",
              marginTop: "12px",
              fontStyle: "normal",
            }}
          >
            — 內部箴言 · MAXIMA INTERNA
          </div>
        </blockquote>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
            stroke="var(--bronze)"
            strokeWidth="0.8"
            style={{ opacity: 0.6 }}
            aria-hidden="true"
          >
            <circle cx="20" cy="20" r="18" />
            <circle cx="20" cy="20" r="12" />
            <circle cx="20" cy="20" r="3" fill="var(--bronze)" />
            <line x1="20" y1="2" x2="20" y2="38" />
            <line x1="2" y1="20" x2="38" y2="20" />
          </svg>
        </div>
      </section>

      {/* ── Two-column grid ───────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "7fr 5fr",
          gap: "48px",
          marginBottom: "64px",
        }}
      >
        {/* LEFT column */}
        <div>
          {/* § 01 Approval queue */}
          <div className="editorial-reveal editorial-d4">
            <div style={sectionHeadStyle}>
              <div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--bronze)", letterSpacing: "0.2em", marginRight: "14px" }}>§ 01</span>
                <span style={{ fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 400, fontStyle: "italic", letterSpacing: "-0.01em" }}>The Queue</span>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: "14px", color: "var(--ink-soft)", letterSpacing: "0.3em", marginLeft: "12px" }}>代簽核</span>
              </div>
              <Link
                href="/inbox"
                style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.15em", color: "var(--bronze)", textDecoration: "none" }}
              >
                VIEW ALL →
              </Link>
            </div>
            <PendingApprovalList items={pending} />
          </div>

          {/* § 02 Spending */}
          <div className="editorial-reveal editorial-d6" style={{ marginTop: "56px" }}>
            <div style={sectionHeadStyle}>
              <div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--bronze)", letterSpacing: "0.2em", marginRight: "14px" }}>§ 02</span>
                <span style={{ fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 400, fontStyle: "italic", letterSpacing: "-0.01em" }}>Quarterly Outflow</span>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: "14px", color: "var(--ink-soft)", letterSpacing: "0.3em", marginLeft: "12px" }}>本季支出</span>
              </div>
            </div>
            <div
              style={{
                border: "1px solid var(--line)",
                padding: "28px",
                background: "var(--paper-2)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "72px",
                  fontWeight: 300,
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                  fontFeatureSettings: "'tnum'",
                }}
              >
                <span style={{ fontSize: "24px", fontWeight: 400, verticalAlign: "top", marginRight: "6px", color: "var(--ink-soft)" }}>NT$</span>
                —
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.2em", color: "var(--ink-soft)", marginTop: "6px", textTransform: "uppercase" }}>
                費用統計功能開發中
              </div>
              <div style={{ marginTop: "24px", display: "grid", gap: "10px" }}>
                {[
                  { cat: "差旅費", color: "var(--bronze)", pct: 0 },
                  { cat: "辦公雜支", color: "var(--patina)", pct: 0 },
                  { cat: "招待客戶", color: "var(--vermillion)", pct: 0 },
                  { cat: "教育訓練", color: "var(--gold)", pct: 0 },
                ].map((b) => (
                  <div key={b.cat} style={{ display: "grid", gridTemplateColumns: "80px 1fr 60px", gap: "12px", alignItems: "center", fontSize: "11px" }}>
                    <span style={{ fontWeight: 500 }}>{b.cat}</span>
                    <div style={{ height: "4px", background: "var(--paper-3)", position: "relative", overflow: "hidden" }}>
                      <div
                        className="editorial-grow-bar"
                        style={{ height: "100%", background: b.color, width: `${b.pct}%` }}
                      />
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>—</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT column */}
        <div>
          {/* § 03 This Week */}
          <div className="editorial-reveal editorial-d4">
            <div style={sectionHeadStyle}>
              <div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--bronze)", letterSpacing: "0.2em", marginRight: "14px" }}>§ 03</span>
                <span style={{ fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 400, fontStyle: "italic", letterSpacing: "-0.01em" }}>This Week</span>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: "14px", color: "var(--ink-soft)", letterSpacing: "0.3em", marginLeft: "12px" }}>本周</span>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.15em", color: "var(--bronze)" }}>
                {dt.monthEn} · 第 {weekNum} 周
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                border: "1px solid var(--line)",
                background: "var(--paper-2)",
              }}
            >
              {weekDays.map((d, i) => (
                <div
                  key={i}
                  style={{
                    padding: "12px 8px 8px",
                    textAlign: "center",
                    borderRight: i < 6 ? "1px solid var(--line)" : undefined,
                    borderBottom: "1px solid var(--line)",
                    background: d.isToday ? "rgba(184,68,58,0.05)" : undefined,
                  }}
                >
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink-soft)" }}>{d.dow}</div>
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "22px",
                      fontWeight: 400,
                      marginTop: "4px",
                      fontFeatureSettings: "'tnum'",
                      color: d.isToday ? "var(--vermillion)" : undefined,
                      fontStyle: d.isToday ? "italic" : undefined,
                    }}
                  >
                    {d.num}
                  </div>
                </div>
              ))}
              {weekDays.map((d, i) => (
                <div
                  key={`cell-${i}`}
                  style={{
                    minHeight: "60px",
                    padding: "6px",
                    borderRight: i < 6 ? "1px solid var(--line)" : undefined,
                    background: "var(--paper)",
                    fontSize: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                  }}
                >
                  {d.isToday && (
                    <div style={{ padding: "4px 6px", fontFamily: "var(--font-sans)", fontSize: "10px", lineHeight: 1.3, fontWeight: 500, borderLeft: "2px solid var(--vermillion)", background: "var(--ink)", color: "var(--paper)", borderColor: "var(--vermillion)" }}>
                      本日
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* § 04 Meeting rooms */}
          <div className="editorial-reveal editorial-d5" style={{ marginTop: "40px" }}>
            <div style={sectionHeadStyle}>
              <div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--bronze)", letterSpacing: "0.2em", marginRight: "14px" }}>§ 04</span>
                <span style={{ fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 400, fontStyle: "italic", letterSpacing: "-0.01em" }}>Vessels</span>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: "14px", color: "var(--ink-soft)", letterSpacing: "0.3em", marginLeft: "12px" }}>會議室</span>
              </div>
              <Link
                href="/meeting"
                style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.15em", color: "var(--bronze)", textDecoration: "none" }}
              >
                + RESERVE
              </Link>
            </div>
            <Link
              href="/meeting"
              style={{
                display: "block",
                border: "1px solid var(--line)",
                padding: "28px",
                background: "var(--paper-2)",
                textDecoration: "none",
                color: "var(--ink-soft)",
                textAlign: "center",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                transition: "background 0.25s",
              }}
            >
              前往會議室預約頁面 →
            </Link>
          </div>

          {/* § 05 Compose */}
          <div className="editorial-reveal editorial-d6" style={{ marginTop: "40px" }}>
            <div style={sectionHeadStyle}>
              <div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--bronze)", letterSpacing: "0.2em", marginRight: "14px" }}>§ 05</span>
                <span style={{ fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 400, fontStyle: "italic", letterSpacing: "-0.01em" }}>Compose</span>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: "14px", color: "var(--ink-soft)", letterSpacing: "0.3em", marginLeft: "12px" }}>新增單據</span>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "1px",
                background: "var(--line)",
                border: "1px solid var(--line)",
              }}
            >
              {composeActions.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="editorial-action"
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      letterSpacing: "0.2em",
                      color: "var(--bronze)",
                      opacity: 0.7,
                    }}
                  >
                    {a.num}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontStyle: "italic",
                      fontSize: "18px",
                      fontWeight: 400,
                      marginTop: "28px",
                    }}
                  >
                    {a.en}
                  </div>
                  <div className="action-cn"
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "14px",
                      letterSpacing: "0.25em",
                      marginTop: "4px",
                    }}
                  >
                    {a.zh}
                  </div>
                  <svg
                    className="action-arr"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer marque ────────────────────────── */}
      <footer
        style={{
          marginTop: "80px",
          borderTop: "1px solid var(--line-strong)",
          paddingTop: "32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: "var(--ink-soft)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        <span>企盉顧問 · EIP INTERNAL PORTAL</span>
        <svg
          width="32"
          height="32"
          viewBox="0 0 44 56"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.3, color: "var(--bronze)" }}
          aria-hidden="true"
        >
          <line x1="22" y1="2" x2="22" y2="6" />
          <ellipse cx="22" cy="8" rx="9" ry="2" />
          <path d="M13 10 C 8 16, 8 26, 12 32 L 32 32 C 36 26, 36 16, 31 10" />
          <line x1="13" y1="20" x2="31" y2="20" strokeDasharray="2 2" opacity="0.5" />
          <path d="M30 14 L 40 12 L 36 18" />
          <path d="M13 16 C 6 18, 6 24, 13 26" />
          <line x1="14" y1="32" x2="11" y2="44" />
          <line x1="22" y1="32" x2="22" y2="46" />
          <line x1="30" y1="32" x2="33" y2="44" />
          <line x1="9" y1="48" x2="35" y2="48" strokeWidth="0.8" />
        </svg>
        <span>{dt.year} · VOLUME {dt.month}</span>
      </footer>
    </div>
  );
}
