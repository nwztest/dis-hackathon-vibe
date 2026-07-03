import { LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PendingApprovalPage() {
  const profile = await requireCurrentProfile("/pending-approval", ["admin", "caregiver", "family", "unapproved"]);

  if (profile?.role === "admin" || profile?.role === "caregiver") {
    redirect("/dashboard");
  }

  return (
    <AppShell profile={profile ?? undefined}>
      <main className="page-content narrow">
        <section className="pending-panel">
          <ShieldCheck size={28} />
          <div>
            <h1>Approval needed</h1>
            <p>
              Your email is confirmed. An admin needs to approve this account before the home safety dashboard is available.
            </p>
          </div>
          <div className="pending-detail">
            <LockKeyhole size={18} />
            <span>Current role: {profile?.role ?? "unapproved"}</span>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
