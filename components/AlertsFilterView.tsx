"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Clock3, Ellipsis, Phone, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { acknowledgeAlertAction, escalateAlertAction, resolveAlertAction } from "@/app/actions";
import { SeverityBadge } from "@/components/Status";
import { formatHomeAddress, type AlertRecord, type SeniorHome, type Room } from "@/lib/mock-data";

export function AlertsFilterView({
  alerts,
  homes,
  rooms,
}: {
  alerts: AlertRecord[];
  homes: SeniorHome[];
  rooms: Room[];
}) {
  const [visibleAlerts, setVisibleAlerts] = useState(alerts);
  const unacknowledged = visibleAlerts.filter((alert) => alert.status === "open");
  const acknowledged = visibleAlerts.filter((alert) => alert.status === "acknowledged");
  const activeCount = unacknowledged.length + acknowledged.length;

  useEffect(() => {
    const hasPendingDangerAlert = visibleAlerts.some(
      (alert) => alert.severity === "danger" && alert.status !== "resolved",
    );
    window.dispatchEvent(
      new CustomEvent<boolean>("careguard:pending-danger-change", {
        detail: hasPendingDangerAlert,
      }),
    );
  }, [visibleAlerts]);

  function updateAlertStatus(alertId: string, status: AlertRecord["status"]) {
    setVisibleAlerts((current) =>
      current.map((alert) => (alert.id === alertId ? { ...alert, status } : alert)),
    );
  }

  function updateAlertSeverity(alertId: string, severity: AlertRecord["severity"]) {
    setVisibleAlerts((current) =>
      current.map((alert) => (alert.id === alertId ? { ...alert, severity } : alert)),
    );
  }

  return (
    <>
      <section className="incident-summary" aria-label="Incident summary">
        <div className={unacknowledged.length > 0 ? "urgent" : ""}>
          <AlertTriangle size={20} />
          <strong>{unacknowledged.length}</strong>
          <span>Awaiting response</span>
        </div>
        <div>
          <Clock3 size={20} />
          <strong>{acknowledged.length}</strong>
          <span>Being handled</span>
        </div>
        <div>
          <ShieldCheck size={20} />
          <strong>{activeCount}</strong>
          <span>Total active alerts</span>
        </div>
      </section>

      {activeCount > 0 ? (
        <>
          <IncidentSection
            title="Respond now"
            description="Unacknowledged alerts, ordered for immediate triage."
            emptyMessage="No incidents are waiting for a response."
            alerts={unacknowledged}
            homes={homes}
            rooms={rooms}
            onStatusChange={updateAlertStatus}
            onSeverityChange={updateAlertSeverity}
          />
          <IncidentSection
            title="Being handled"
            description="Acknowledged alerts that still need to be resolved."
            emptyMessage="No incidents are currently being handled."
            alerts={acknowledged}
            homes={homes}
            rooms={rooms}
            onStatusChange={updateAlertStatus}
            onSeverityChange={updateAlertSeverity}
          />
        </>
      ) : (
        <section className="empty-state">
          <ShieldCheck size={28} />
          <h2>No active alerts</h2>
          <p>There are no incidents requiring caregiver action.</p>
        </section>
      )}
    </>
  );
}

function IncidentSection({
  title,
  description,
  emptyMessage,
  alerts,
  homes,
  rooms,
  onStatusChange,
  onSeverityChange,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  alerts: AlertRecord[];
  homes: SeniorHome[];
  rooms: Room[];
  onStatusChange: (alertId: string, status: AlertRecord["status"]) => void;
  onSeverityChange: (alertId: string, severity: AlertRecord["severity"]) => void;
}) {
  return (
    <section className="incident-section">
      <div className="incident-section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <strong>{alerts.length}</strong>
      </div>
      {alerts.length > 0 ? (
        <div className="incident-list">
          {alerts.map((alert) => (
            <IncidentCard
              alert={alert}
              homes={homes}
              rooms={rooms}
              key={alert.id}
              onStatusChange={onStatusChange}
              onSeverityChange={onSeverityChange}
            />
          ))}
        </div>
      ) : (
        <div className="incident-empty"><ShieldCheck size={18} /><span>{emptyMessage}</span></div>
      )}
    </section>
  );
}

function IncidentCard({
  alert,
  homes,
  rooms,
  onStatusChange,
  onSeverityChange,
}: {
  alert: AlertRecord;
  homes: SeniorHome[];
  rooms: Room[];
  onStatusChange: (alertId: string, status: AlertRecord["status"]) => void;
  onSeverityChange: (alertId: string, severity: AlertRecord["severity"]) => void;
}) {
  const router = useRouter();
  const room = rooms.find((item) => item.id === alert.roomId);
  const home = homes.find((item) => item.id === alert.homeId);
  const [moreOpen, setMoreOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [isPending, startTransition] = useTransition();
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;

    function closeMore(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && actionsRef.current?.contains(event.target as Node)) return;
      setMoreOpen(false);
    }

    document.addEventListener("mousedown", closeMore);
    document.addEventListener("keydown", closeMore);

    return () => {
      document.removeEventListener("mousedown", closeMore);
      document.removeEventListener("keydown", closeMore);
    };
  }, [moreOpen]);

  function changeStatus(status: "acknowledged" | "resolved") {
    setActionError("");
    setMoreOpen(false);
    startTransition(async () => {
      try {
        if (status === "acknowledged") {
          await acknowledgeAlertAction(alert.id);
        } else {
          await resolveAlertAction(alert.id);
        }
        onStatusChange(alert.id, status);
        router.refresh();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Could not update this alert.");
      }
    });
  }

  function upgradeToDanger() {
    setActionError("");
    setMoreOpen(false);
    startTransition(async () => {
      try {
        await escalateAlertAction(alert.id);
        onSeverityChange(alert.id, "danger");
        router.refresh();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Could not upgrade this alert.");
      }
    });
  }

  return (
    <article className={`incident-card ${alert.severity}`}>
      <div className="incident-card-main">
        <div className="incident-title-row">
          <SeverityBadge severity={alert.severity} />
          <span>{alert.status === "open" ? "Not acknowledged" : alert.status}</span>
        </div>
        <h3>{humanizeReason(alert.reason)}</h3>
        <p>{home?.seniorName ?? "Unknown senior"} · {room?.name ?? "Unknown room"}</p>
        <p className="incident-evidence">{alert.evidence}</p>
      </div>
      <dl className="incident-facts">
        <div><dt>Opened</dt><dd>{alert.openedAt}</dd></div>
        <div><dt>Duration</dt><dd>{alert.duration || "—"}</dd></div>
        <div><dt>Confidence</dt><dd>{alert.confidence}%</dd></div>
        <div><dt>Location</dt><dd>{home ? formatHomeAddress(home) : "Unknown"}</dd></div>
      </dl>
      <div className="incident-actions" ref={actionsRef}>
        {alert.status === "open" ? (
          <button
            className="primary-button"
            disabled={isPending}
            onClick={() => changeStatus("acknowledged")}
            type="button"
          >
            {isPending ? "Updating…" : "Acknowledge"}
          </button>
        ) : (
          <button disabled={isPending} onClick={() => changeStatus("resolved")} type="button">
            {isPending ? "Updating…" : "Resolve"}
          </button>
        )}
        <button
          aria-expanded={moreOpen}
          className="incident-more-button"
          onClick={() => setMoreOpen((open) => !open)}
          type="button"
        >
          <Ellipsis size={17} />
          More
        </button>
        {moreOpen ? (
          <div aria-label="More alert actions" className="incident-more-menu" role="group">
            {room?.deviceType === "room_camera" ? (
              <Link
                href={`/demo/camera?roomId=${encodeURIComponent(room.id)}`}
              >
                <Camera size={16} />
                Access camera
              </Link>
            ) : null}
            {home?.emergencyContactPhone ? (
              <a href={`tel:${home.emergencyContactPhone}`}>
                <Phone size={16} />
                Call caregiver
              </a>
            ) : null}
            {home?.seniorPhone ? (
              <a href={`tel:${home.seniorPhone}`}>
                <Phone size={16} />
                Call senior
              </a>
            ) : null}
            {alert.status === "open" ? (
              <button
                disabled={isPending}
                onClick={() => changeStatus("resolved")}
                type="button"
              >
                <ShieldCheck size={16} />
                Resolve
              </button>
            ) : null}
            {alert.severity === "suspicious" && alert.status !== "resolved" ? (
              <button
                className="danger-menu-item"
                disabled={isPending}
                onClick={upgradeToDanger}
                type="button"
              >
                <AlertTriangle size={16} />
                Upgrade to danger
              </button>
            ) : null}
            <Link href={`/rooms/${alert.roomId}`}>
              View room details
            </Link>
          </div>
        ) : null}
        {actionError ? <p className="action-error" role="alert">{actionError}</p> : null}
      </div>
    </article>
  );
}

function humanizeReason(reason: string) {
  const labels: Record<string, string> = {
    fall_detected: "Fall detected",
    possible_fall_transition: "Possible fall",
    lying_on_floor_more_than_60_seconds: "Person lying on the floor for over a minute",
    lying_on_floor_with_movement: "Person moving while lying on the floor",
    lying_on_floor_watch: "Person may be lying on the floor",
    large_low_blob_in_shower: "Possible person down in the shower",
    blood_detected: "Possible blood detected",
    no_movement_on_bed_sofa_chair_watch: "Extended period without movement",
  };
  return labels[reason] ?? reason.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
