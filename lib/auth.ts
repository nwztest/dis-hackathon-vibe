import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
};

export type UserRole = "admin" | "caregiver" | "family" | "unapproved";

type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole | null;
  phone: string | null;
};

const approvedRoles: UserRole[] = ["admin", "caregiver"];

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  if (!hasSupabaseEnv()) {
    return {
      id: "prototype-user",
      name: "Prototype admin",
      email: "mock-data@careguard.local",
      role: "admin",
      phone: "",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const profileRow = profile as ProfileRow | null;
  const userName = user.user_metadata?.name;

  return {
    id: user.id,
    name: profileRow?.name || (typeof userName === "string" ? userName : "") || user.email || "CareGuard user",
    email: profileRow?.email || user.email || "",
    role: profileRow?.role ?? "unapproved",
    phone: profileRow?.phone ?? "",
  };
}

export async function hasRealSupabaseSession() {
  if (!hasSupabaseEnv()) return false;

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return Boolean(!error && user);
}

export async function getSignedInDestination() {
  if (!hasSupabaseEnv()) return null;

  const profile = await getCurrentProfile();
  if (!profile) return null;

  return approvedRoles.includes(profile.role) ? "/dashboard" : "/pending-approval";
}

export async function requireCurrentProfile(nextPath: string, allowedRoles: UserRole[] = approvedRoles) {
  const profile = await getCurrentProfile();

  if (!profile && hasSupabaseEnv()) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  if (profile && hasSupabaseEnv() && !allowedRoles.includes(profile.role)) {
    redirect("/pending-approval");
  }

  return profile;
}

export async function requireAdminProfile(nextPath: string) {
  return requireCurrentProfile(nextPath, ["admin"]);
}
