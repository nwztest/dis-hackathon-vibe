"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Eye, ShieldCheck, X } from "lucide-react";
import type { AlertNotification } from "@/lib/alert-notifications";
import { SeverityBadge } from "@/components/Status";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function IncidentNotificationModal({
  notification,
  onAcknowledge,
  onDismiss,
  onViewRoom,
}: {
  notification: AlertNotification;
  onAcknowledge: (notification: AlertNotification) => Promise<void>;
  onDismiss: (notification: AlertNotification) => void;
  onViewRoom: (notification: AlertNotification) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const [actionError, setActionError] = useState("");
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss(notification);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [notification, onDismiss]);

  async function acknowledge() {
    setActionError("");
    setIsAcknowledging(true);
    try {
      await onAcknowledge(notification);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not acknowledge this alert.");
      setIsAcknowledging(false);
    }
  }

  return (
    <div className="modal-backdrop incident-notification-backdrop" role="presentation">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`modal-panel incident-notification ${notification.severity}`}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="incident-notification-head">
          <div className="incident-notification-title">
            <span className="incident-notification-icon" aria-hidden="true">
              <AlertTriangle size={22} />
            </span>
            <div>
              <SeverityBadge severity={notification.severity} />
              <h2 id={titleId}>
                {notification.severity === "danger" ? "Danger alert" : "Suspicious activity"}
              </h2>
            </div>
          </div>
          <button
            aria-label="Dismiss notification"
            className="icon-button"
            disabled={isAcknowledging}
            onClick={() => onDismiss(notification)}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="incident-notification-location">
          <strong>{notification.seniorName}</strong>
          <span>{notification.roomName}</span>
        </div>

        <div id={descriptionId} className="incident-notification-copy">
          <strong>{humanizeReason(notification.reason)}</strong>
          {notification.evidence ? <p>{notification.evidence}</p> : null}
        </div>

        <dl className="incident-notification-facts">
          <div>
            <dt>Confidence</dt>
            <dd>{notification.confidence}%</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Awaiting response</dd>
          </div>
        </dl>

        {actionError ? <p className="action-error" role="alert">{actionError}</p> : null}

        <div className="incident-notification-actions">
          <button
            disabled={isAcknowledging}
            onClick={() => onDismiss(notification)}
            type="button"
          >
            Dismiss
          </button>
          <button
            className="secondary-button"
            disabled={isAcknowledging}
            onClick={() => onViewRoom(notification)}
            type="button"
          >
            <Eye size={16} />
            View room
          </button>
          <button
            className={notification.severity === "danger" ? "danger-button" : "primary-button"}
            disabled={isAcknowledging}
            onClick={acknowledge}
            type="button"
          >
            <ShieldCheck size={16} />
            {isAcknowledging ? "Acknowledging…" : "Acknowledge"}
          </button>
        </div>
      </section>
    </div>
  );
}

function humanizeReason(reason: string) {
  if (!reason) return "A safety event needs review";
  const label = reason.replaceAll("_", " ");
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}
