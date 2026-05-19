"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ajusteStock,
  consumirReserva,
  createRepuesto,
  createReserva,
  desactivarRepuesto,
  entradaStock,
  getMovimientos,
  getRepuestoById,
  getRepuestos,
  getReservasByTicket,
  liberarReserva,
  updateRepuesto,
  type AjusteStockPayload,
  type CreateRepuestoPayload,
  type CreateReservaPayload,
  type EntradaStockPayload,
  type MovimientosFilters,
  type RepuestosFilters,
  type ReservaActionPayload,
  type UpdateRepuestoPayload,
} from "@/lib/api/inventario";

const REPUESTOS_KEY = ["inventario", "repuestos"] as const;

export function useRepuestos(filters: RepuestosFilters = {}) {
  return useQuery({
    queryFn: () => getRepuestos(filters),
    queryKey: [...REPUESTOS_KEY, filters],
  });
}

export function useRepuesto(id?: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => getRepuestoById(id as string),
    queryKey: [...REPUESTOS_KEY, id],
  });
}

function invalidateRepuestos(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: REPUESTOS_KEY });
}

export function useCreateRepuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRepuestoPayload) => createRepuesto(payload),
    onSuccess: () => invalidateRepuestos(qc),
  });
}

export function useUpdateRepuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateRepuestoPayload;
    }) => updateRepuesto(id, payload),
    onSuccess: () => invalidateRepuestos(qc),
  });
}

export function useDesactivarRepuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => desactivarRepuesto(id),
    onSuccess: () => invalidateRepuestos(qc),
  });
}

export function useEntradaStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: EntradaStockPayload;
    }) => entradaStock(id, payload),
    onSuccess: () => invalidateRepuestos(qc),
  });
}

export function useAjusteStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: AjusteStockPayload;
    }) => ajusteStock(id, payload),
    onSuccess: () => invalidateRepuestos(qc),
  });
}

export function useMovimientos(filters: MovimientosFilters = {}) {
  return useQuery({
    queryFn: () => getMovimientos(filters),
    queryKey: ["inventario", "movimientos", filters],
  });
}

// ---------- Reservas ----------

export function useReservasByTicket(ticketId: string) {
  return useQuery({
    queryFn: () => getReservasByTicket(ticketId),
    queryKey: ["inventario", "reservas", "ticket", ticketId],
    enabled: Boolean(ticketId),
  });
}

function invalidateReservas(
  qc: ReturnType<typeof useQueryClient>,
  ticketId?: string,
) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: REPUESTOS_KEY }),
    qc.invalidateQueries({
      queryKey: ticketId
        ? ["inventario", "reservas", "ticket", ticketId]
        : ["inventario", "reservas"],
    }),
  ]);
}

export function useCreateReserva(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateReservaPayload) =>
      createReserva(ticketId, payload),
    onSuccess: () => invalidateReservas(qc, ticketId),
  });
}

export function useLiberarReserva(ticketId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload?: ReservaActionPayload;
    }) => liberarReserva(id, payload ?? {}),
    onSuccess: () => invalidateReservas(qc, ticketId),
  });
}

export function useConsumirReserva(ticketId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload?: ReservaActionPayload;
    }) => consumirReserva(id, payload ?? {}),
    onSuccess: () => invalidateReservas(qc, ticketId),
  });
}
