import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAllTickets, type TicketFetcher, type TicketTrabajo } from "./tickets";

/**
 * Fetch de tickets en el servidor (RSC) para prefetch + HydrationBoundary.
 *
 * Reusa getAllTickets() inyectando un fetcher que adjunta el access_token de la
 * sesión Supabase (leída de cookies) como Bearer, igual que authFetch hace en el
 * cliente. cache:"no-store" porque los tickets cambian con cada transición.
 *
 * No lanza si no hay sesión: devuelve [] y deja que el cliente refetchee con su
 * propia sesión — el prefetch es una optimización, no un requisito.
 */
export async function getTicketsServer(): Promise<TicketTrabajo[]> {
  // Sin env de Supabase (ej. durante el build en CI) no hay sesión que prefetch:
  // devolvemos [] y el cliente carga con su propia sesión. Evita que createClient
  // lance al recolectar page data.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return [];
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (!token) return [];

  const serverFetcher: TicketFetcher = (input, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers, cache: "no-store" });
  };

  return getAllTickets(serverFetcher);
}
