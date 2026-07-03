import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (code && hasSupabaseEnv()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/sign-in?message=confirmation-error", request.url));
    }
    return NextResponse.redirect(await postAuthRedirectUrl(supabase, request.url, next));
  }

  return NextResponse.redirect(new URL(next, request.url));
}

async function postAuthRedirectUrl(supabase: Awaited<ReturnType<typeof createClient>>, requestUrl: string, next: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new URL("/sign-in", requestUrl);

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role;
  const destination = role === "admin" || role === "caregiver" ? next : "/pending-approval";

  return new URL(destination, requestUrl);
}
