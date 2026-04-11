export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      {/* Step 2 實作 Sidebar */}
      <div className="flex-1 flex flex-col">
        {/* Step 2 實作 Header */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
