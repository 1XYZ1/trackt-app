import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require-role";
import { MovimientosClient } from "./movimientos-client";

export const metadata: Metadata = {
  title: "Movimientos de inventario | Trackt",
  description:
    "Historial de entradas, salidas, reservas y consumos del inventario.",
};

export default async function MovimientosPage() {
  // Solo admin y jefe_taller pueden ver el historial global (mechanic no
  // accede a movimientos para no exponer trazabilidad cruzada de tenant).
  await requireRole("admin", "jefe_taller");
  return <MovimientosClient />;
}
