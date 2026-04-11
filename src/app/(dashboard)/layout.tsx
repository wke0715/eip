"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";

// TODO: Step 3 替換為真實 session 資料
const mockUser = {
  name: "佑霖",
  email: "wke0715@gmail.com",
  image: null,
  role: "ADMIN" as const,
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = mockUser.role === "ADMIN";

  return (
    <div className="flex h-screen">
      <Sidebar isAdmin={isAdmin} />
      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        isAdmin={isAdmin}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          user={mockUser}
          onMenuClick={() => setMobileMenuOpen(true)}
          onSignOut={() => {
            // TODO: Step 3 實作 signOut
          }}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
