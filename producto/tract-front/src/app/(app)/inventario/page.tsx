import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require-role";
import { InventarioClient } from "./inventario-client";

export const metadata: Metadata = {
  title: "Inventario | Trackt",
  description: "Gestion de repuestos del taller y stock disponible.",
};

export default async function InventarioPage() {
  // Mechanic reserva desde el detalle del ticket — la pantalla de inventario
  // es informativa/administrativa para admin y jefe_taller.
  await requireRole("admin", "jefe_taller");
  return <InventarioClient />;
}
