import type { Metadata } from "next";
import { MantencionesClient } from "./mantenciones-client";

export const metadata: Metadata = {
  title: "Mantenciones | Trackt",
  description: "Calendario y programaciones de mantenimiento preventivo.",
};

export default function MantencionesPage() {
  return <MantencionesClient />;
}
