"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { acknowledgeAlertAction } from "@/app/actions";
import { IncidentNotificationModal } from "@/components/IncidentNotificationModal";
import type { CurrentProfile } from "@/lib/auth";
import {
  enqueueAlertNotification,
  hasPendingDangerAlert,
  notificationKey,
  removeAlertNotifications,
  seedAlertSnapshots,
  shouldNotifyForAlertChange,
  type AlertNotification,
  type AlertSnapshot,
} from "@/lib/alert-notifications";
import { navItems, type AlertRecord, type AlertStatus } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";

const realtimeRefreshDebounceMs = 300;
const recoveryRefreshIntervalMs = 30_000;

type RealtimeAlertRow = {
  id?: unknown;
  home_id?: unknown;
  room_id?: unknown;
  severity?: unknown;
  status?: unknown;
  reason?: unknown;
  evidence?: unknown;
  confidence?: unknown;
};

type EnrichedAlertRow = RealtimeAlertRow & {
  homes?: { senior_name?: unknown } | Array<{ senior_name?: unknown }> | null;
  rooms?: { name?: unknown } | Array<{ name?: unknown }> | null;
};

export function AppShellClient({
  children,
  profile,
  initialActiveAlerts,
}: {
  children: React.ReactNode;
  profile?: CurrentProfile;
  initialActiveAlerts: AlertRecord[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initialSnapshots = seedAlertSnapshots(initialActiveAlerts);
  const alertSnapshotsRef = useRef(initialSnapshots);
  const pathnameRef = useRef(pathname);
  const seenNotificationKeysRef = useRef(new Set<string>());
  const [notificationQueue, setNotificationQueue] = useState<AlertNotification[]>([]);
  const [showPendingDangerAlert, setShowPendingDangerAlert] = useState(
    hasPendingDangerAlert(initialSnapshots.values()),
  );
  const profileName = profile?.name ?? "Account";
  const profileEmail = profile?.email ?? "Not signed in";
  const profileRole = profile?.role ?? "guest";
  const canUseApp = profileRole === "admin" || profileRole === "caregiver";
  const seenNotificationsStorageKey = `careguard:seen-alert-notifications:${profile?.id ?? "guest"}`;

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const snapshots = seedAlertSnapshots(initialActiveAlerts);
    alertSnapshotsRef.current = snapshots;
    setShowPendingDangerAlert(hasPendingDangerAlert(snapshots.values()));
    setNotificationQueue((current) =>
      current.filter((notification) => {
        const alert = snapshots.get(notification.id);
        return alert?.status === "open" && alert.severity === notification.severity;
      }),
    );
  }, [initialActiveAlerts]);

  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    try {
      const storedKeys = JSON.parse(sessionStorage.getItem(seenNotificationsStorageKey) ?? "[]");
      if (Array.isArray(storedKeys)) {
        seenNotificationKeysRef.current = new Set(
          storedKeys.filter((value): value is string => typeof value === "string"),
        );
      }
    } catch {
      seenNotificationKeysRef.current = new Set();
    }
  }, [seenNotificationsStorageKey]);

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

  useEffect(() => {
    if (!hasSupabaseEnv() || !canUseApp) return;

    const supabase = createClient();
    let refreshTimer: number | undefined;

    function scheduleRefresh(change: "alert" | "room", roomId?: string) {
      const currentPath = pathnameRef.current;
      const shouldRefresh =
        change === "alert"
          ? isOperationalPath(currentPath)
          : currentPath === "/dashboard" || roomPathMatches(currentPath, roomId);
      if (!shouldRefresh) return;

      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => router.refresh(), realtimeRefreshDebounceMs);
    }

    function persistSeenNotificationKeys() {
      try {
        const recentKeys = Array.from(seenNotificationKeysRef.current).slice(-200);
        seenNotificationKeysRef.current = new Set(recentKeys);
        sessionStorage.setItem(seenNotificationsStorageKey, JSON.stringify(recentKeys));
      } catch {
        // A notification should still display when session storage is unavailable.
      }
    }

    async function enqueueFromRealtime(snapshot: AlertSnapshot) {
      const key = notificationKey(snapshot);
      if (seenNotificationKeysRef.current.has(key)) return;

      seenNotificationKeysRef.current.add(key);
      persistSeenNotificationKeys();

      const notification = await enrichAlertNotification(supabase, snapshot);
      const latest = alertSnapshotsRef.current.get(snapshot.id);
      if (latest?.status !== "open" || latest.severity !== snapshot.severity) return;

      setNotificationQueue((current) => enqueueAlertNotification(current, notification));
    }

    function handleAlertChange(payload: {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: Record<string, unknown>;
      old: Record<string, unknown>;
    }) {
      if (payload.eventType === "DELETE") {
        const deletedId = stringValue(payload.old.id);
        if (deletedId) {
          alertSnapshotsRef.current.delete(deletedId);
          setNotificationQueue((current) => removeAlertNotifications(current, deletedId));
          setShowPendingDangerAlert(hasPendingDangerAlert(alertSnapshotsRef.current.values()));
        }
        scheduleRefresh("alert");
        return;
      }

      const next = snapshotFromRealtimeRow(payload.new);
      if (!next) {
        scheduleRefresh("alert");
        return;
      }

      const previous = alertSnapshotsRef.current.get(next.id);
      alertSnapshotsRef.current.set(next.id, next);
      setShowPendingDangerAlert(hasPendingDangerAlert(alertSnapshotsRef.current.values()));

      if (next.status !== "open") {
        setNotificationQueue((current) => removeAlertNotifications(current, next.id));
      } else if (shouldNotifyForAlertChange(payload.eventType, previous, next)) {
        void enqueueFromRealtime(next);
      }

      scheduleRefresh("alert");
    }

    const channel = supabase
      .channel("careguard-operational-events")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        (payload) => handleAlertChange(payload as typeof payload & {
          eventType: "INSERT" | "UPDATE" | "DELETE";
          new: Record<string, unknown>;
          old: Record<string, unknown>;
        }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_status_events" },
        (payload) => {
          const roomId = stringValue((payload.new as Record<string, unknown>).room_id);
          scheduleRefresh("room", roomId);
        },
      )
      .subscribe();

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [canUseApp, router, seenNotificationsStorageKey]);

  useEffect(() => {
    if (!hasSupabaseEnv() || !canUseApp || !isOperationalPath(pathname)) return;

    const refreshVisiblePage = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const intervalId = window.setInterval(refreshVisiblePage, recoveryRefreshIntervalMs);
    window.addEventListener("focus", refreshVisiblePage);
    document.addEventListener("visibilitychange", refreshVisiblePage);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshVisiblePage);
      document.removeEventListener("visibilitychange", refreshVisiblePage);
    };
  }, [canUseApp, pathname, router]);

  const dismissNotification = useCallback((notification: AlertNotification) => {
    setNotificationQueue((current) => removeAlertNotifications(current, notification.id));
  }, []);

  const viewNotificationRoom = useCallback((notification: AlertNotification) => {
    setNotificationQueue((current) => removeAlertNotifications(current, notification.id));
    router.push(`/rooms/${notification.roomId}`);
  }, [router]);

  const acknowledgeNotification = useCallback(async (notification: AlertNotification) => {
    await acknowledgeAlertAction(notification.id);
    const current = alertSnapshotsRef.current.get(notification.id);
    if (current) {
      alertSnapshotsRef.current.set(notification.id, { ...current, status: "acknowledged" });
    }
    setNotificationQueue((queue) => removeAlertNotifications(queue, notification.id));
    setShowPendingDangerAlert(hasPendingDangerAlert(alertSnapshotsRef.current.values()));
    router.refresh();
  }, [router]);

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
      {notificationQueue[0] ? (
        <IncidentNotificationModal
          notification={notificationQueue[0]}
          onAcknowledge={acknowledgeNotification}
          onDismiss={dismissNotification}
          onViewRoom={viewNotificationRoom}
        />
      ) : null}
    </div>
  );
}

function snapshotFromRealtimeRow(row: RealtimeAlertRow): AlertSnapshot | null {
  const id = stringValue(row.id);
  const homeId = stringValue(row.home_id);
  const roomId = stringValue(row.room_id);
  const severity = row.severity === "danger" || row.severity === "suspicious" ? row.severity : null;
  const status = isAlertStatus(row.status) ? row.status : null;
  if (!id || !homeId || !roomId || !severity || !status) return null;

  const parsedConfidence = Number(row.confidence ?? 0);
  return {
    id,
    homeId,
    roomId,
    severity,
    status,
    reason: stringValue(row.reason),
    evidence: stringValue(row.evidence),
    confidence: Number.isFinite(parsedConfidence) ? parsedConfidence : 0,
  };
}

async function enrichAlertNotification(
  supabase: ReturnType<typeof createClient>,
  fallback: AlertSnapshot,
): Promise<AlertNotification> {
  const { data } = await supabase
    .from("alerts")
    .select(`
      id,
      home_id,
      room_id,
      severity,
      status,
      reason,
      evidence,
      confidence,
      homes (senior_name),
      rooms (name)
    `)
    .eq("id", fallback.id)
    .maybeSingle();
  const row = data as EnrichedAlertRow | null;
  const enrichedSnapshot = row ? snapshotFromRealtimeRow(row) : null;
  const home = firstRelatedRecord(row?.homes);
  const room = firstRelatedRecord(row?.rooms);

  return {
    ...(enrichedSnapshot ?? fallback),
    seniorName: stringValue(home?.senior_name) || "Unknown senior",
    roomName: stringValue(room?.name) || "Unknown room",
  };
}

function firstRelatedRecord<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isAlertStatus(value: unknown): value is AlertStatus {
  return value === "open" || value === "acknowledged" || value === "resolved";
}

function isOperationalPath(pathname: string) {
  return pathname === "/dashboard" || pathname === "/alerts" || pathname.startsWith("/rooms/");
}

function roomPathMatches(pathname: string, roomId?: string) {
  if (!roomId || !pathname.startsWith("/rooms/")) return false;
  return decodeURIComponent(pathname.slice("/rooms/".length).split("/", 1)[0]) === roomId;
}
