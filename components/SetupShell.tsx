import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { setupSteps } from "@/lib/mock-data";

export function SetupShell({
  children,
  currentStep,
}: {
  children: React.ReactNode;
  currentStep: number;
}) {
  return (
    <div className="setup-page">
      <header className="setup-header">
        <Link className="setup-brand" href="/dashboard">
          <ShieldCheck size={20} />
          CareGuard
        </Link>
        <Link className="text-link" href="/dashboard">Exit setup</Link>
      </header>
      <main className="setup-main">
        <div className="stepper" aria-label="Device setup progress">
          {setupSteps.map((step, index) => (
            <Link
              className={index + 1 <= currentStep ? "step active" : "step"}
              href={step.href}
              key={step.href}
            >
              <span>{index + 1}</span>
              {step.label}
            </Link>
          ))}
        </div>
        {children}
      </main>
    </div>
  );
}
