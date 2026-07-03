"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "create-account";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeMessage = searchParams.get("message");
  const initialMessage =
    routeMessage === "confirmation-error" ? "Confirmation link could not be verified. Try signing in or request a new account email." : "";
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [message, setMessage] = useState(initialMessage);
  const [messageTone, setMessageTone] = useState<"default" | "success">("default");
  const [isPending, startTransition] = useTransition();
  const next = searchParams.get("next") ?? "/dashboard";
  const isSignIn = mode === "sign-in";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseEnv()) {
      router.push("/dashboard");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "");

    startTransition(async () => {
      const supabase = createClient();
      setMessage("");
      setMessageTone("default");

      if (isSignIn) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage(error.message);
          return;
        }
        router.push(next);
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard`,
          data: {
            name,
          },
        },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessageTone("success");
      setMessage("Account created. Confirm your email, then wait for an admin to approve dashboard access.");
      setMode("sign-in");
    });
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setMessageTone("default");
  }

  function onResetPassword(event: FormEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    const formData = form ? new FormData(form) : null;
    const email = String(formData?.get("email") ?? "");

    if (!email) {
      setMessage("Enter your email address first.");
      setMessageTone("default");
      return;
    }

    if (!hasSupabaseEnv()) {
      setMessage("Supabase env is not configured. Password reset would be sent from Supabase Auth.");
      setMessageTone("default");
      return;
    }

    startTransition(async () => {
      setMessage("");
      setMessageTone("default");
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/sign-in`,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessageTone("success");
      setMessage("Password reset email sent.");
    });
  }

  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <div className="auth-switch" role="tablist" aria-label="Authentication mode">
        <button
          aria-selected={isSignIn}
          className={isSignIn ? "active" : ""}
          onClick={() => switchMode("sign-in")}
          role="tab"
          type="button"
        >
          Sign in
        </button>
        <button
          aria-selected={!isSignIn}
          className={!isSignIn ? "active" : ""}
          onClick={() => switchMode("create-account")}
          role="tab"
          type="button"
        >
          Create account
        </button>
      </div>
      {!isSignIn ? (
        <label>
          Name
          <input name="name" placeholder="Caregiver name" required />
        </label>
      ) : null}
      <label>
        Email address
        <input name="email" type="email" placeholder="name@example.com" required />
      </label>
      <label>
        <span className="split-label">
          Password
          {isSignIn ? (
            <button className="text-button" type="button" onClick={onResetPassword} disabled={isPending}>
              Forgot password?
            </button>
          ) : null}
        </span>
        <input
          autoComplete={isSignIn ? "current-password" : "new-password"}
          minLength={6}
          name="password"
          type="password"
          placeholder={isSignIn ? "Password" : "Create a password"}
          required
        />
      </label>
      {message ? <p className={messageTone === "success" ? "form-note success" : "form-note"}>{message}</p> : null}
      <button className="primary-button full" type="submit" disabled={isPending}>
        {isPending ? "Working..." : isSignIn ? "Sign in" : "Create account"}
      </button>
      {!hasSupabaseEnv() ? (
        <Link className="text-link" href="/dashboard">Continue with mock data</Link>
      ) : null}
    </form>
  );
}
