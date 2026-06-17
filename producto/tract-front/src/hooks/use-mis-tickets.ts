"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  finalizarEjecucion,
  getMiTicketById,
  getMisTickets,
  iniciarEjecucion,
  subirEvidencia,
  type FinalizarTicketPayload,
} from "@/lib/api/mis-tickets";

export function useMisTickets() {
  return useQuery({
    queryFn: getMisTickets,
    queryKey: ["mis-tickets"],
  });
}

export function useMiTicket(id?: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => getMiTicketById(id as string),
    queryKey: ["mis-tickets", id],
  });
}

export function useIniciarEjecucion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: iniciarEjecucion,
    onSuccess: async (ticket) => {
      queryClient.setQueryData(["mis-tickets", ticket.id], ticket);
      // Invalidar tambien las vistas de admin/jefe (tickets, ordenes) que
      // reflejan el mismo ticket; si no, quedan stale hasta el poll. Iniciar no
      // cambia el estado de la OT, así que basta el detalle ["ordenes", id].
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mis-tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["tickets"], exact: true }),
        queryClient.invalidateQueries({ queryKey: ["ordenes", ticket.ordenId] }),
      ]);
    },
  });
}

export function useSubirEvidencia(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => subirEvidencia(ticketId, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mis-tickets", ticketId] });
    },
  });
}

export function useFinalizarEjecucion(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: FinalizarTicketPayload) =>
      finalizarEjecucion(ticketId, payload),
    onSuccess: async (ticket) => {
      queryClient.setQueryData(["mis-tickets", ticketId], ticket);
      // Finalizar no cierra la OT (eso ocurre en validar/cerrar), así que
      // invalidamos el detalle de la OT y no la lista completa.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mis-tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["tickets"], exact: true }),
        queryClient.invalidateQueries({ queryKey: ["ordenes", ticket.ordenId] }),
      ]);
    },
  });
}
