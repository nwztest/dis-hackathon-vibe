"use client";

import { FormEvent, useState } from "react";
import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";
import type { SeniorHome } from "@/lib/mock-data";

type ButtonVariant = "primary" | "secondary" | "plain";

function buttonClass(variant: ButtonVariant) {
  if (variant === "primary") return "primary-button";
  if (variant === "plain") return "text-button";
  return "secondary-button";
}

export function AddHomeButton({ variant = "primary" }: { variant?: ButtonVariant }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <>
      <button className={buttonClass(variant)} type="button" onClick={() => setOpen(true)}>
        <Plus size={16} />
        Add home
      </button>
      {open ? (
        <ModalFrame title="Add home" onClose={() => { setOpen(false); setSubmitted(false); }}>
          <form className="modal-form" onSubmit={onSubmit}>
            <label>Senior name<input placeholder="Tan Ah Kow" /></label>
            <label>Phone<input placeholder="+65 9123 4567" /></label>
            <label>Emergency contact<input placeholder="Tan Mei Ling" /></label>
            <label>Medical details<textarea placeholder="Diabetes, fall risk, mild hypertension" rows={3} /></label>
            <div className="form-grid">
              <label>Block number<input placeholder="123" /></label>
              <label>Unit number<input placeholder="08-456" /></label>
            </div>
            <label>Address<input placeholder="Jurong West Street 41" /></label>
            {submitted ? <p className="form-note">UI-only prototype: this would create the home in the database.</p> : null}
            <div className="modal-actions">
              <button type="button" onClick={() => { setOpen(false); setSubmitted(false); }}>Cancel</button>
              <button className="primary-button" type="submit">Create home</button>
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
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <>
      <button className={buttonClass(variant)} type="button" onClick={() => setOpen(true)}>
        <Plus size={16} />
        Add room
      </button>
      {open ? (
        <ModalFrame title="Add room" onClose={() => { setOpen(false); setSubmitted(false); }}>
          <form className="modal-form" onSubmit={onSubmit}>
            <label>
              Home
              <select defaultValue={defaultHomeId ?? homes[0]?.id}>
                {homes.map((home) => (
                  <option value={home.id} key={home.id}>{home.seniorName} · Blk {home.blockNumber}, #{home.unitNumber}</option>
                ))}
              </select>
            </label>
            <label>Room name<input placeholder="Bedroom" /></label>
            <div className="form-grid">
              <label>
                Room type
                <select defaultValue="room">
                  <option value="room">Room</option>
                  <option value="shower">Shower</option>
                </select>
              </label>
              <label>
                Device type
                <select defaultValue="room_camera">
                  <option value="room_camera">Room camera</option>
                  <option value="tof_shower">Shower ToF</option>
                </select>
              </label>
            </div>
            {submitted ? <p className="form-note">UI-only prototype: this would create the room in the database.</p> : null}
            <div className="modal-actions">
              <button type="button" onClick={() => { setOpen(false); setSubmitted(false); }}>Cancel</button>
              <button className="primary-button" type="submit">Create room</button>
            </div>
          </form>
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
