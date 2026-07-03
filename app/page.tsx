import { redirect } from "next/navigation";
import { getSignedInDestination } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const destination = await getSignedInDestination();
  if (destination) {
    redirect(destination);
  }

  redirect("/sign-in");
}
