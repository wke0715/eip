import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-muted-foreground">403</h1>
        <p className="mt-4 text-xl font-medium">禁止存取</p>
        <p className="mt-2 text-muted-foreground">
          你沒有權限存取此頁面
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          返回儀表板
        </Link>
      </div>
    </div>
  );
}
