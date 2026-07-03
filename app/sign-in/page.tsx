import { LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInForm } from "@/components/SignInForm";
import { getSignedInDestination } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const destination = await getSignedInDestination();
  if (destination) {
    redirect(destination);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-header">
          <ShieldCheck size={36} />
          <h1>CareGuard</h1>
          <p>Access the senior home monitoring dashboard.</p>
        </div>
        <Suspense>
          <SignInForm />
        </Suspense>
        <div className="privacy-note">
          <LockKeyhole size={18} />
          <p>
            <strong>Privacy first.</strong> Room cameras analyze still photos every 5 seconds. Showers use depth sensing only,
            and microphone support is left for a later module.
          </p>
        </div>
      </section>
    </main>
  );
}
