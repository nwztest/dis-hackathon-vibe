import { redirect } from "next/navigation";
import { requireCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomesPage() {
  await requireCurrentProfile("/homes");
  redirect("/dashboard");
}
