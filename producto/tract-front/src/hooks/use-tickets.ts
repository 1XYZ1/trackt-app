"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTicketFromOrden,
  getTicketById,
  getTickets,
  type CreateTicketPayload,
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
