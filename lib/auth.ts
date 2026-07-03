import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "caregiver" | "family";
  phone: string;
};

type ProfileRow = {
  id: string;
  name: string | null;
  role: CurrentProfile["role"] | null;
  phone: string | null;
};

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
    email: user.email ?? "",
    role: profileRow?.role ?? "caregiver",
    phone: profileRow?.phone ?? "",
  };
}

export async function requireCurrentProfile(nextPath: string) {
  const profile = await getCurrentProfile();

  if (!profile && hasSupabaseEnv()) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  return profile;
}
