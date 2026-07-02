import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-header">
          <ShieldCheck size={36} />
          <h1>CareGuard</h1>
          <p>Sign in to monitor senior homes.</p>
        </div>
        <form className="form-stack">
          <label>
            Email address
            <input type="email" placeholder="name@example.com" />
          </label>
          <label>
            <span className="split-label">
              Password
              <a href="#">Forgot password?</a>
            </span>
            <input type="password" placeholder="Password" />
          </label>
          <Link className="primary-button full" href="/homes">
            Sign in
          </Link>
        </form>
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
