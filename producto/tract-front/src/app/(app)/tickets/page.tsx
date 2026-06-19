import type { Metadata } from "next";
import { TicketsClient, type TicketsSearchParams } from "./tickets-client";

type TicketsPageProps = {
  searchParams: Promise<TicketsSearchParams>;
};

export const metadata: Metadata = {
  title: "Tickets | Trackt",
  description:
    "Listado global de tickets de taller con filtros por estado, mecanico y OT.",
};

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  // Sin prefetch en servidor: el cliente carga los tickets vía React Query
  // (useTickets) y pinta el skeleton de kanban/lista mientras tanto. El
  // loading.tsx da la transición instantánea. Antes esta página era
  // `force-dynamic` y await-eaba getAllTickets (todas las páginas paginadas)
  // bloqueando la navegación y duplicando el fetch en cliente.
  const params = await searchParams;
  return <TicketsClient initialFilters={params} />;
}
