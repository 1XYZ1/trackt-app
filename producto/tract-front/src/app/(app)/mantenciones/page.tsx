import type { Metadata } from "next";
import { MantencionesClient } from "./mantenciones-client";

type MantencionesPageProps = {
  // Deep-link desde la ficha del equipo: ?equipo=<id>&plantilla=<id> abre el
  // alta de programación preseleccionada.
  searchParams: Promise<{ equipo?: string; plantilla?: string }>;
};

export const metadata: Metadata = {
  title: "Mantenciones | Trackt",
  description: "Calendario y programaciones de mantenimiento preventivo.",
};

export default async function MantencionesPage({
  searchParams,
}: MantencionesPageProps) {
  const { equipo, plantilla } = await searchParams;
  const initialDefaults =
    equipo || plantilla
      ? { equipoId: equipo, plantillaId: plantilla }
      : null;
  return <MantencionesClient initialDefaults={initialDefaults} />;
}
