"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  HelpCircle,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import type { CurrentProfile } from "@/lib/auth";
import { navItems } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export function AppShellClient({
  children,
  profile,
  hasPendingDangerAlert,
}: {
  children: React.ReactNode;
  profile?: CurrentProfile;
  hasPendingDangerAlert: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPendingDangerAlert, setShowPendingDangerAlert] = useState(hasPendingDangerAlert);
  const profileName = profile?.name ?? "Account";
  const profileEmail = profile?.email ?? "Not signed in";
  const profileRole = profile?.role ?? "guest";
  const canUseApp = profileRole === "admin" || profileRole === "caregiver";

  useEffect(() => {
    setShowPendingDangerAlert(hasPendingDangerAlert);
  }, [hasPendingDangerAlert]);

  useEffect(() => {
    setSidebarOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    function closeSidebar(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    }

    document.body.classList.add("mobile-nav-open");
    window.addEventListener("keydown", closeSidebar);

    return () => {
      document.body.classList.remove("mobile-nav-open");
      window.removeEventListener("keydown", closeSidebar);
    };
  }, [sidebarOpen]);

  useEffect(() => {
    function updateDangerIndicator(event: Event) {
      setShowPendingDangerAlert((event as CustomEvent<boolean>).detail);
    }

    window.addEventListener("careguard:pending-danger-change", updateDangerIndicator);
    return () => window.removeEventListener("careguard:pending-danger-change", updateDangerIndicator);
  }, []);

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
      <aside
        aria-label="Main menu"
        className={sidebarOpen ? "sidebar open" : "sidebar"}
        id="primary-sidebar"
      >
        <div className="brand-block">
          <div className="brand-identity">
            <div className="brand-mark">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="brand-name">CareGuard</div>
              <div className="brand-role">Home safety dashboard</div>
            </div>
          </div>
          <button
            aria-label="Close navigation menu"
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="side-nav" aria-label="Primary navigation">
          {navItems.filter((item) => canUseApp && (!item.roles || item.roles.includes(profileRole))).map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/dashboard" && pathname.startsWith("/rooms"));
            const Icon = item.icon;
            const showDangerIndicator = item.href === "/alerts" && showPendingDangerAlert;
            return (
              <Link
                className={active ? "nav-link active" : "nav-link"}
                href={item.href}
                key={item.href}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {showDangerIndicator ? (
                  <span
                    className="nav-alert-indicator"
                    role="status"
                    aria-label="Danger alert awaiting response"
                    title="Danger alert awaiting response"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
        {canUseApp ? (
          <div className="sidebar-footer">
            <Link
              className="nav-link"
              href="/setup/select-room"
              onClick={() => setSidebarOpen(false)}
            >
              <HelpCircle size={18} />
              <span>Device setup</span>
            </Link>
          </div>
        ) : null}
      </aside>
      <button
        aria-hidden={!sidebarOpen}
        aria-label="Close navigation menu"
        className={sidebarOpen ? "sidebar-backdrop visible" : "sidebar-backdrop"}
        onClick={() => setSidebarOpen(false)}
        tabIndex={sidebarOpen ? 0 : -1}
        type="button"
      />
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-header-brand">
            <button
              aria-controls="primary-sidebar"
              aria-expanded={sidebarOpen}
              aria-label="Open navigation menu"
              className="mobile-menu-button"
              onClick={() => setSidebarOpen(true)}
              type="button"
            >
              <Menu size={21} />
            </button>
            <div className="mobile-brand">CareGuard</div>
          </div>
          <div className="topbar-actions">
            <a className="danger-button emergency-services-button" href="tel:995">
              <AlertTriangle size={16} />
              Call Emergency Services
            </a>
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
