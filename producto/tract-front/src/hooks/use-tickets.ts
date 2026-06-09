"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TicketEstado } from "@/components/core";
import {
  asignarTicket,
  cerrarTicket,
  createTicketFromOrden,
  finalizarTicket,
  getCargaMecanicos,
  getTicketById,
  getTickets,
  iniciarTicket,
  reasignarTicket,
  validarTicket,
  type AsignarTicketPayload,
  type CerrarTicketPayload,
  type CreateTicketPayload,
  type FinalizarTicketRawPayload,
  type ReasignarTicketPayload,
  type TicketTrabajo,
  type ValidarTicketPayload,
} from "@/lib/api/tickets";

const TICKETS_KEY = ["tickets"] as const;

export function useTickets() {
  return useQuery({
    queryFn: getTickets,
    queryKey: TICKETS_KEY,
    // Override del staleTime global (60s): el kanban se opera en vivo, así que
    // refrescamos al volver a la pestaña y con un staleTime más corto.
    refetchOnWindowFocus: true,
    staleTime: 30_000,
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
        queryClient.invalidateQueries({ queryKey: TICKETS_KEY, exact: true }),
        queryClient.invalidateQueries({ queryKey: ["ordenes"] }),
        queryClient.invalidateQueries({ queryKey: ["ordenes", ordenId] }),
      ]);
    },
  });
}

type OptimisticPatch<TPayload> = (
  ticket: TicketTrabajo,
  payload: TPayload,
) => Partial<TicketTrabajo>;

type TransitionContext = {
  previousList?: TicketTrabajo[];
  ordenId?: string;
};

/**
 * Helper de transición con optimistic update sobre la lista ["tickets"].
 *
 * - onMutate: cancela refetches en vuelo, snapshotea la lista y aplica el patch
 *   optimista para que el kanban/lista muevan la card al instante.
 * - onError: rollback al snapshot + el dialog/caller muestra el toast con el
 *   mensaje del backend (ej. 409 por carrera de estado).
 * - onSuccess: escribe el ticket fresco en su cache de detalle (gratis).
 * - onSettled: invalida ["tickets"] e ["ordenes", ordenId] de forma acotada.
 */
function useTicketTransition<TPayload>(
  ticketId: string,
  mutationFn: (id: string, payload: TPayload) => Promise<TicketTrabajo>,
  optimisticPatch?: OptimisticPatch<TPayload>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TPayload) => mutationFn(ticketId, payload),
    onMutate: async (payload): Promise<TransitionContext> => {
      await queryClient.cancelQueries({ queryKey: TICKETS_KEY });
      const previousList =
        queryClient.getQueryData<TicketTrabajo[]>(TICKETS_KEY);
      const current = previousList?.find((t) => t.id === ticketId);

      if (previousList && optimisticPatch) {
        queryClient.setQueryData<TicketTrabajo[]>(TICKETS_KEY, (old) =>
          old?.map((t) =>
            t.id === ticketId ? { ...t, ...optimisticPatch(t, payload) } : t,
          ),
        );
      }
      return { previousList, ordenId: current?.ordenId };
    },
    onError: (_err, _payload, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(TICKETS_KEY, context.previousList);
      }
    },
    onSuccess: (ticket) => {
      queryClient.setQueryData(["tickets", ticketId], ticket);
    },
    onSettled: async (ticket, _err, _payload, context) => {
      const ordenId = ticket?.ordenId ?? context?.ordenId;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: TICKETS_KEY, exact: true }),
        ordenId
          ? queryClient.invalidateQueries({ queryKey: ["ordenes", ordenId] })
          : Promise.resolve(),
        // La lista de OTs puede cambiar su estado cuando un ticket se cierra
        // (cascada de cierre de OT), así que la refrescamos también.
        queryClient.invalidateQueries({ queryKey: ["ordenes"], exact: true }),
      ]);
    },
  });
}

function patchEstado(estado: TicketEstado): Partial<TicketTrabajo> {
  return { estado };
}

export function useAsignarTicket(ticketId: string) {
  return useTicketTransition<AsignarTicketPayload>(
    ticketId,
    asignarTicket,
    (_t, payload) => ({
      estado: "ASIGNADO",
      mecanico: { id: payload.mecanicoId },
    }),
  );
}

export function useReasignarTicket(ticketId: string) {
  return useTicketTransition<ReasignarTicketPayload>(
    ticketId,
    reasignarTicket,
    (_t, payload) => ({
      estado: "ASIGNADO",
      mecanico: { id: payload.mecanicoId },
    }),
  );
}

export function useIniciarTicket(ticketId: string) {
  return useTicketTransition<void>(ticketId, (id) => iniciarTicket(id), () =>
    patchEstado("EN_EJECUCION"),
  );
}

export function useFinalizarTicket(ticketId: string) {
  return useTicketTransition<FinalizarTicketRawPayload>(
    ticketId,
    finalizarTicket,
    () => patchEstado("EJECUTADO"),
  );
}

export function useValidarTicket(ticketId: string) {
  return useTicketTransition<ValidarTicketPayload>(
    ticketId,
    validarTicket,
    (_t, payload) =>
      patchEstado(payload.aprobado ? "CERRADO" : "EN_EJECUCION"),
  );
}

export function useCerrarTicket(ticketId: string) {
  return useTicketTransition<CerrarTicketPayload>(ticketId, cerrarTicket, () =>
    patchEstado("CERRADO"),
  );
}

/**
 * Iniciar ejecución desde el kanban, donde el ticketId viene en cada drop (no se
 * puede instanciar un hook por ticket). Mismo patrón optimista que
 * useTicketTransition pero con el id en las variables de mutate().
 */
export function useIniciarTicketKanban() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: string) => iniciarTicket(ticketId),
    onMutate: async (ticketId): Promise<TransitionContext> => {
      await queryClient.cancelQueries({ queryKey: TICKETS_KEY });
      const previousList =
        queryClient.getQueryData<TicketTrabajo[]>(TICKETS_KEY);
      const current = previousList?.find((t) => t.id === ticketId);
      if (previousList) {
        queryClient.setQueryData<TicketTrabajo[]>(TICKETS_KEY, (old) =>
          old?.map((t) =>
            t.id === ticketId ? { ...t, estado: "EN_EJECUCION" } : t,
          ),
        );
      }
      return { previousList, ordenId: current?.ordenId };
    },
    onError: (_err, _ticketId, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(TICKETS_KEY, context.previousList);
      }
    },
    onSuccess: (ticket) => {
      queryClient.setQueryData(["tickets", ticket.id], ticket);
    },
    onSettled: async (ticket, _err, _ticketId, context) => {
      const ordenId = ticket?.ordenId ?? context?.ordenId;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: TICKETS_KEY, exact: true }),
        ordenId
          ? queryClient.invalidateQueries({ queryKey: ["ordenes", ordenId] })
          : Promise.resolve(),
      ]);
    },
  });
}

export function useCargaMecanicos() {
  return useQuery({
    queryFn: getCargaMecanicos,
    queryKey: ["tickets", "carga-mecanicos"],
  });
}

/**
 * Devuelve un callback para prefetchear el detalle de un ticket (al hover de una
 * card/fila). Calienta la cache ["tickets", id] que consume useTicket(), así la
 * navegación al detalle es instantánea.
 */
export function usePrefetchTicket() {
  const queryClient = useQueryClient();
  return (id: string) =>
    queryClient.prefetchQuery({
      queryKey: ["tickets", id],
      queryFn: () => getTicketById(id),
      staleTime: 30_000,
    });
}
