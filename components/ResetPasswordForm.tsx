"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";

type RecoveryState = "checking" | "ready" | "invalid" | "saving" | "saved";

export function ResetPasswordForm() {
  const [state, setState] = useState<RecoveryState>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      setState("invalid");
      setMessage("Supabase is not configured, so this reset link cannot be verified.");
      return;
    }

    const supabase = createClient();
    let isMounted = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (!isMounted) return;

      if (error || !data.user) {
        setState("invalid");
        setMessage("This password reset link is invalid or has expired.");
        return;
      }

      setState("ready");
    });

    return () => {
      isMounted = false;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");

    setMessage("");

    if (password !== passwordConfirmation) {
      setMessage("Passwords do not match.");
      return;
    }

    setState("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setState("ready");
      setMessage(error.message);
      return;
    }

    setState("saved");
    setMessage("Your password has been updated.");

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setMessage("Your password was updated, but existing sessions could not be signed out. Sign out manually on shared devices.");
      return;
    }

    window.location.replace("/sign-in?message=password-updated");
  }

  if (state === "checking") {
    return <p className="form-note" role="status">Verifying your reset link...</p>;
  }

  if (state === "invalid") {
    return (
      <div className="form-stack">
        <p className="form-note" role="alert">{message}</p>
        <Link className="primary-button full" href="/sign-in">Request a new reset link</Link>
      </div>
    );
  }

  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <label>
        New password
        <input
          autoComplete="new-password"
          minLength={8}
          name="password"
          placeholder="At least 8 characters"
          required
          type="password"
        />
      </label>
      <label>
        Confirm new password
        <input
          autoComplete="new-password"
          minLength={8}
          name="passwordConfirmation"
          placeholder="Enter the password again"
          required
          type="password"
        />
      </label>
      {message ? (
        <p className={state === "saved" ? "form-note success" : "form-note"} role={state === "saved" ? "status" : "alert"}>
          {message}
        </p>
      ) : null}
      <button className="primary-button full" disabled={state === "saving" || state === "saved"} type="submit">
        {state === "saving" ? "Updating password..." : state === "saved" ? "Password updated" : "Update password"}
      </button>
    </form>
  );
}
