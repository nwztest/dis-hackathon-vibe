"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const next = searchParams.get("next") ?? "/dashboard";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseEnv()) {
      router.push("/dashboard");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        return;
      }
      router.push(next);
      router.refresh();
    });
  }

  async function onSignUp() {
    if (!hasSupabaseEnv()) {
      router.push("/dashboard");
      return;
    }

    const email = window.prompt("Email address");
    const password = window.prompt("Password");
    if (!email || !password) return;

    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    setMessage(error ? error.message : "Account created. Check email confirmation settings, then sign in.");
  }

  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <label>
        Email address
        <input name="email" type="email" placeholder="name@example.com" required />
      </label>
      <label>
        <span className="split-label">
          Password
          <a href="#">Forgot password?</a>
        </span>
        <input name="password" type="password" placeholder="Password" required />
      </label>
      {message ? <p className="form-note">{message}</p> : null}
      <button className="primary-button full" type="submit" disabled={isPending}>
        {isPending ? "Signing in..." : "Sign in"}
      </button>
      <button className="secondary-button full" type="button" onClick={onSignUp}>
        Create account
      </button>
      {!hasSupabaseEnv() ? (
        <Link className="text-link" href="/dashboard">Continue with mock data</Link>
      ) : null}
    </form>
  );
}
