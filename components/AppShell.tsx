"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Bell, HelpCircle, ShieldCheck, UserRound } from "lucide-react";
import { navItems } from "@/lib/mock-data";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="brand-name">CareGuard</div>
            <div className="brand-role">Home safety dashboard</div>
          </div>
        </div>
        <nav className="side-nav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/dashboard" && pathname.startsWith("/rooms"));
            const Icon = item.icon;
            return (
              <Link className={active ? "nav-link active" : "nav-link"} href={item.href} key={item.href}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <Link className="nav-link" href="/setup/select-room">
            <HelpCircle size={18} />
            <span>Device setup</span>
          </Link>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">CareGuard</div>
          <div className="topbar-actions">
            <button className="danger-button" type="button">
              <AlertTriangle size={16} />
              Call emergency contact
            </button>
            <button className="icon-button" aria-label="Notifications" type="button">
              <Bell size={18} />
            </button>
            <button className="icon-button" aria-label="User profile" type="button">
              <UserRound size={18} />
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
