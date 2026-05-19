"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  asignarTicket,
  cerrarTicket,
  createTicketFromOrden,
  getCargaMecanicos,
  getTicketById,
  getTickets,
  reasignarTicket,
  validarTicket,
  type AsignarTicketPayload,
  type CerrarTicketPayload,
  type CreateTicketPayload,
  type ReasignarTicketPayload,
  type ValidarTicketPayload,
} from "@/lib/api/tickets";

export function useTickets() {
  return useQuery({
    queryFn: getTickets,
    queryKey: ["tickets"],
  });
}

export function useTicket(id?: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => getTicketById(id as string),
    queryKey: ["tickets", id],
  });
}

export function useCreateTicketFromOrden(ordenId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTicketPayload) =>
      createTicketFromOrden(ordenId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["ordenes"] }),
        queryClient.invalidateQueries({ queryKey: ["ordenes", ordenId] }),
      ]);
    },
  });
}

function useTicketTransition<TPayload>(
  ticketId: string,
  mutationFn: (id: string, payload: TPayload) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TPayload) => mutationFn(ticketId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["tickets", ticketId] }),
        queryClient.invalidateQueries({ queryKey: ["ordenes"] }),
      ]);
    },
  });
}

export function useAsignarTicket(ticketId: string) {
  return useTicketTransition<AsignarTicketPayload>(ticketId, asignarTicket);
}

export function useReasignarTicket(ticketId: string) {
  return useTicketTransition<ReasignarTicketPayload>(ticketId, reasignarTicket);
}

export function useCargaMecanicos() {
  return useQuery({
    queryFn: getCargaMecanicos,
    queryKey: ["tickets", "carga-mecanicos"],
  });
}

export function useValidarTicket(ticketId: string) {
  return useTicketTransition<ValidarTicketPayload>(ticketId, validarTicket);
}

export function useCerrarTicket(ticketId: string) {
  return useTicketTransition<CerrarTicketPayload>(ticketId, cerrarTicket);
}
