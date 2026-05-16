import type { Metadata } from "next";
import { MiTicketDetalleClient } from "./mi-ticket-detalle-client";

type MiTicketDetallePageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Ejecutar ticket | Trackt",
  description: "Vista movil para ejecutar ticket, subir evidencia y finalizar.",
};

export default async function MiTicketDetallePage({
  params,
}: MiTicketDetallePageProps) {
  const { id } = await params;

  return <MiTicketDetalleClient id={id} />;
}
