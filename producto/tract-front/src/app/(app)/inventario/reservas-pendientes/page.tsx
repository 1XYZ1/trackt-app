import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require-role";
import { ReservasPendientesClient } from "./reservas-pendientes-client";

export const metadata: Metadata = {
  title: "Solicitudes pendientes | Trackt",
  description:
    "Reservas de repuestos solicitadas por mecanicos esperando aprobacion.",
};

export default async function ReservasPendientesPage() {
  await requireRole("admin", "jefe_taller");
  return <ReservasPendientesClient />;
}
