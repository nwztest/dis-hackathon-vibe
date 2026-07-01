import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-header">
          <ShieldCheck size={36} />
          <h1>CareGuard</h1>
          <p>Sign in to the privacy dashboard.</p>
        </div>
        <form className="form-stack">
          <label>
            Email address
            <input type="email" placeholder="name@facility.com" />
          </label>
          <label>
            <span className="split-label">
              Password
              <a href="#">Forgot password?</a>
            </span>
            <input type="password" placeholder="Password" />
          </label>
          <Link className="primary-button full" href="/facilities">
            Sign in
          </Link>
        </form>
        <div className="privacy-note">
          <LockKeyhole size={18} />
          <p>
            <strong>Privacy first.</strong> No camera feed, no video, and no resident identity data in this prototype.
            Monitoring uses motion, orientation, and distance signals only.
          </p>
        </div>
      </section>
    </main>
  );
}
