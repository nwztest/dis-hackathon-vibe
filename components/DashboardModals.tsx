"use client";

import { FormEvent, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import type { SeniorHome } from "@/lib/mock-data";
import {
  createHomeAction,
  createRoomAction,
  deleteCameraAction,
  deleteHomeAction,
  deleteRoomAction,
  type ActionState,
} from "@/app/actions";

type ButtonVariant = "primary" | "secondary" | "plain";

function buttonClass(variant: ButtonVariant) {
  if (variant === "primary") return "primary-button";
  if (variant === "plain") return "text-button";
  return "secondary-button";
}

export function AddHomeButton({ variant = "primary" }: { variant?: ButtonVariant }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      setState(await createHomeAction(formData));
    });
  }

  return (
    <>
      <button className={buttonClass(variant)} type="button" onClick={() => setOpen(true)}>
        <Plus size={16} />
        Add home
      </button>
      {open ? (
        <ModalFrame title="Add home" onClose={() => { setOpen(false); setState(null); }}>
          <form className="modal-form" onSubmit={onSubmit}>
            <label>Senior name<input name="seniorName" placeholder="Tan Ah Kow" required /></label>
            <label>Phone<input name="seniorPhone" placeholder="+65 9123 4567" /></label>
            <label>Emergency contact<input name="emergencyContactName" placeholder="Tan Mei Ling" /></label>
            <label>Emergency contact phone<input name="emergencyContactPhone" placeholder="+65 9876 5432" /></label>
            <label>Medical details<textarea name="medicalDetails" placeholder="Diabetes, fall risk, mild hypertension" rows={3} /></label>
            <div className="form-grid">
              <label>Block number<input name="blockNumber" placeholder="123" required /></label>
              <label>Unit number<input name="unitNumber" placeholder="08-456" required /></label>
            </div>
            <label>Address<input name="address" placeholder="Jurong West Street 41" /></label>
            {state ? <p className={state.ok ? "form-note success" : "form-note"}>{state.message}</p> : null}
            <div className="modal-actions">
              <button type="button" onClick={() => { setOpen(false); setState(null); }}>Cancel</button>
              <button className="primary-button" type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create home"}</button>
            </div>
          </form>
        </ModalFrame>
      ) : null}
    </>
  );
}

export function AddRoomButton({
  homes,
  defaultHomeId,
  variant = "secondary",
}: {
  homes: SeniorHome[];
  defaultHomeId?: string;
  variant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      setState(await createRoomAction(formData));
    });
  }

  return (
    <>
      <button className={buttonClass(variant)} type="button" onClick={() => setOpen(true)}>
        <Plus size={16} />
        Add room
      </button>
      {open ? (
        <ModalFrame title="Add room" onClose={() => { setOpen(false); setState(null); }}>
          <form className="modal-form" onSubmit={onSubmit}>
            <label>
              Home
              <select name="homeId" defaultValue={defaultHomeId ?? homes[0]?.id} required>
                {homes.map((home) => (
                  <option value={home.id} key={home.id}>{home.seniorName} · Blk {home.blockNumber}, #{home.unitNumber}</option>
                ))}
              </select>
            </label>
            <label>Room name<input name="roomName" placeholder="Bedroom" required /></label>
            <div className="form-grid">
              <label>
                Room type
                <select name="roomType" defaultValue="room">
                  <option value="room">Room</option>
                  <option value="shower">Shower</option>
                </select>
              </label>
              <label>
                Device type
                <select name="deviceType" defaultValue="room_camera">
                  <option value="room_camera">Room camera</option>
                  <option value="tof_shower">Shower ToF</option>
                </select>
              </label>
            </div>
            {state ? <p className={state.ok ? "form-note success" : "form-note"}>{state.message}</p> : null}
            <div className="modal-actions">
              <button type="button" onClick={() => { setOpen(false); setState(null); }}>Cancel</button>
              <button className="primary-button" type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create room"}</button>
            </div>
          </form>
        </ModalFrame>
      ) : null}
    </>
  );
}

export function DeleteHomeButton({
  homeId,
  homeName,
  roomCount,
}: {
  homeId: string;
  homeName: string;
  roomCount: number;
}) {
  return (
    <DeleteEntityButton
      description={
        roomCount > 0
          ? `This will also permanently delete ${roomCount} ${roomCount === 1 ? "room" : "rooms"} and their devices, alerts, and status history.`
          : "This home has no rooms. Deleting it will permanently remove its senior profile."
      }
      entityId={homeId}
      entityName={homeName}
      entityType="home"
    />
  );
}

export function DeleteRoomButton({
  afterDeleteHref,
  roomId,
  roomName,
}: {
  afterDeleteHref?: string;
  roomId: string;
  roomName: string;
}) {
  return (
    <DeleteEntityButton
      afterDeleteHref={afterDeleteHref}
      description="This will permanently delete the room and its device, alerts, and status history."
      entityId={roomId}
      entityName={roomName}
      entityType="room"
    />
  );
}

export function DeleteCameraButton({
  cameraUid,
  cameraName,
}: {
  cameraUid: string;
  cameraName: string;
}) {
  return (
    <DeleteEntityButton
      description="This permanently revokes the camera credentials and removes it from the room. The room will remain and switch to offline if it has no other attached device."
      entityId={cameraUid}
      entityName={cameraName}
      entityType="camera"
    />
  );
}

function DeleteEntityButton({
  afterDeleteHref,
  description,
  entityId,
  entityName,
  entityType,
}: {
  afterDeleteHref?: string;
  description: string;
  entityId: string;
  entityName: string;
  entityType: "camera" | "home" | "room";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const label = `Delete ${entityType}`;

  function onDelete() {
    startTransition(async () => {
      const result = entityType === "home"
        ? await deleteHomeAction(entityId)
        : entityType === "room"
          ? await deleteRoomAction(entityId)
          : await deleteCameraAction(entityId);

      if (result.ok) {
        setOpen(false);
        setState(null);
        if (afterDeleteHref) router.push(afterDeleteHref);
        router.refresh();
        return;
      }

      setState(result);
    });
  }

  return (
    <>
      <button className="delete-button" type="button" onClick={() => setOpen(true)}>
        <Trash2 size={16} />
        {label}
      </button>
      {open ? (
        <ModalFrame title={`${label}?`} onClose={() => { setOpen(false); setState(null); }}>
          <div className="delete-confirmation">
            <p>
              You are about to delete <strong>{entityName}</strong>.
            </p>
            <p>{description}</p>
            {state ? <p className="form-note">{state.message}</p> : null}
            <div className="modal-actions">
              <button type="button" onClick={() => { setOpen(false); setState(null); }}>Cancel</button>
              <button className="danger-button" type="button" disabled={isPending} onClick={onDelete}>
                <Trash2 size={16} />
                {isPending ? "Deleting..." : `Delete ${entityType}`}
              </button>
            </div>
          </div>
        </ModalFrame>
      ) : null}
    </>
  );
}

function ModalFrame({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
