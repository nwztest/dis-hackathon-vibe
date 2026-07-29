import { KeyRound, ShieldCheck } from "lucide-react";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-header">
          <ShieldCheck size={36} />
          <h1>Choose a new password</h1>
          <p>Use a strong password that you do not use for another account.</p>
        </div>
        <ResetPasswordForm />
        <div className="privacy-note">
          <KeyRound size={18} />
          <p>Your reset link is single-use and expires. CareGuard will never ask you to send your password by email.</p>
        </div>
      </section>
    </main>
  );
}
