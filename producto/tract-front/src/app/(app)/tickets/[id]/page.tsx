import type { Metadata } from "next";
import { TicketDetalleClient } from "./ticket-detalle-client";

type TicketDetallePageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Detalle Ticket | Trackt",
  description: "Detalle de ticket de taller con timeline de estados.",
};

export default async function TicketDetallePage({
  params,
}: TicketDetallePageProps) {
  const { id } = await params;

  return <TicketDetalleClient id={id} />;
}
