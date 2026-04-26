import Link from "next/link";

interface DashboardCardsProps {
  pendingCount: number;
  inProgressCount: number;
  approvedCount: number;
  rejectedCount: number;
}

const statSuffix: React.CSSProperties = {
  fontStyle: "italic",
  color: "var(--bronze)",
  fontSize: "0.5em",
  verticalAlign: "super",
  marginLeft: "4px",
  fontWeight: 500,
};

const statLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "16px",
};

const statNum: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "64px",
  fontWeight: 300,
  lineHeight: 1,
  letterSpacing: "-0.04em",
  fontFeatureSettings: "'tnum'",
};

const statFoot: React.CSSProperties = {
  marginTop: "14px",
  paddingTop: "12px",
  borderTop: "1px dashed var(--line)",
  display: "flex",
  justifyContent: "space-between",
  fontSize: "11px",
  color: "var(--ink-soft)",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function DashboardCards({
  pendingCount,
  inProgressCount,
  approvedCount,
  rejectedCount,
}: DashboardCardsProps) {
  const stats = [
    {
      href: "/inbox",
      label: "待簽核 · Pending",
      count: pendingCount,
      suffix: "件",
      foot: "代我簽核",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
    },
    {
      href: "/outbox?tab=pending",
      label: "簽核中 · In Flight",
      count: inProgressCount,
      suffix: undefined,
      foot: "等待他人審核",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
        </svg>
      ),
    },
    {
      href: "/outbox?tab=approved",
      label: "已結案 · Closed",
      count: approvedCount,
      suffix: undefined,
      foot: "本季累計",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    },
    {
      href: "/outbox?tab=rejected",
      label: "退簽 · Returned",
      count: rejectedCount,
      suffix: undefined,
      foot: "需修正後重送",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
    },
  ];

  return (
    <section
      className="editorial-reveal editorial-d2"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        borderTop: "1px solid var(--line-strong)",
        borderBottom: "1px solid var(--line-strong)",
        marginBottom: "64px",
      }}
    >
      {stats.map((s, i) => (
        <Link
          key={s.href}
          href={s.href}
          className="editorial-stat"
          style={{
            padding: "28px 24px 24px",
            borderRight: i < 3 ? "1px solid var(--line)" : undefined,
            position: "relative",
            display: "block",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={statLabel}>
            <span>{s.label}</span>
            <span style={{ opacity: 0.5 }}>{s.icon}</span>
          </div>
          <div className="editorial-stat-num" style={statNum}>
            {pad(s.count)}
            {s.suffix && <em style={statSuffix}>{s.suffix}</em>}
          </div>
          <div style={statFoot}>
            <span>{s.foot}</span>
          </div>
        </Link>
      ))}
    </section>
  );
}
