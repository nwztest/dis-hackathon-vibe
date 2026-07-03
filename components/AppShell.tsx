"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Bell, HelpCircle, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { navItems } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";
import type { CurrentProfile } from "@/lib/auth";

export function AppShell({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile?: CurrentProfile;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileName = profile?.name ?? "Account";
  const profileEmail = profile?.email ?? "Not signed in";
  const profileRole = profile?.role ?? "guest";

  async function signOut() {
    if (hasSupabaseEnv()) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push("/sign-in");
    router.refresh();
  }

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
            <div className="profile-menu">
              <button
                aria-expanded={profileOpen}
                aria-label="View profile"
                className="profile-button"
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
              >
                <UserRound size={18} />
                <span>{profileName}</span>
              </button>
              {profileOpen ? (
                <div className="profile-popover">
                  <div>
                    <strong>{profileName}</strong>
                    <span>{profileEmail}</span>
                  </div>
                  <dl>
                    <div>
                      <dt>Role</dt>
                      <dd>{profileRole}</dd>
                    </div>
                    {profile?.phone ? (
                      <div>
                        <dt>Phone</dt>
                        <dd>{profile.phone}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <button type="button" onClick={signOut}>
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
