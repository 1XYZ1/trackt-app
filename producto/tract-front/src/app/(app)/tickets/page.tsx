import type { Metadata } from "next";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { getTicketsServer } from "@/lib/api/tickets.server";
import { TicketsClient, type TicketsSearchParams } from "./tickets-client";

type TicketsPageProps = {
  searchParams: Promise<TicketsSearchParams>;
};

export const metadata: Metadata = {
  title: "Tickets | Trackt",
  description:
    "Listado global de tickets de taller con filtros por estado, mecanico y OT.",
};

// La página depende de la sesión (cookies) → siempre dinámica, nunca estática.
export const dynamic = "force-dynamic";

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const params = await searchParams;

  // Prefetch en el servidor para que el primer paint del kanban/lista llegue con
  // datos (sin spinner). La queryKey coincide con useTickets() → hidratación
  // directa. Best-effort: si falla (sin env en build, sesión ausente, API caída),
  // el cliente refetchea con su propia sesión.
  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: ["tickets"],
      queryFn: getTicketsServer,
    });
  } catch {
    // Degrada al fetch del cliente.
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TicketsClient initialFilters={params} />
    </HydrationBoundary>
  );
}
