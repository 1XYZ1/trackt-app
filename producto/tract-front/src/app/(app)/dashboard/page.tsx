import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/require-role";
import { DashboardAdmin } from "./dashboard-admin";

export default async function DashboardPage() {
  const profile = await requireSession();

  if (profile.role === "mechanic") {
    redirect("/mis-tickets");
  }

  return <DashboardAdmin profile={profile} />;
}
