import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require-role";
import { CargaMecanicosClient } from "./carga-mecanicos-client";

export const metadata: Metadata = {
  title: "Carga de mecánicos | Trackt",
  description: "Resumen operativo de carga de trabajo por mecánico del taller.",
};

export default async function CargaMecanicosPage() {
  // admin y jefe_taller son los únicos roles autorizados.
  await requireRole("admin", "jefe_taller");
  return <CargaMecanicosClient />;
}
