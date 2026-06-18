import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/require-role";
import { defaultRouteForRole } from "@/lib/auth/default-route";
import { DashboardAdmin } from "./dashboard-admin";

export default async function DashboardPage() {
  const profile = await requireSession();

  // El dashboard es para admin/jefe_taller. Otros roles van a su home
  // (mechanic → /mis-tickets, jefe_inventario → /inventario).
  if (profile.role !== "admin" && profile.role !== "jefe_taller") {
    redirect(defaultRouteForRole(profile.role));
  }

  return <DashboardAdmin profile={profile} />;
}
