"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOrden,
  getOrdenById,
  getOrdenes,
  type CreateOrdenPayload,
} from "@/lib/api/ordenes";

export function useOrdenes() {
  // El filtrado es client-side (getOrdenes no recibe params). La queryKey NO
  // incluye filtros: evita entradas de cache redundantes y mantiene una sola
  // key invalidable ["ordenes"].
  return useQuery({
    queryFn: getOrdenes,
    queryKey: ["ordenes"],
  });
}

export function useOrden(id?: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => getOrdenById(id as string),
    queryKey: ["ordenes", id],
  });
}

/**
 * Devuelve un callback para prefetchear el detalle de una OT (al hover de una
 * card/fila). Calienta la cache ["ordenes", id] que consume useOrden(), así la
 * navegación al detalle es instantánea.
 */
export function usePrefetchOrden() {
  const queryClient = useQueryClient();
  return (id: string) =>
    queryClient.prefetchQuery({
      queryKey: ["ordenes", id],
      queryFn: () => getOrdenById(id),
    });
}

export function useCreateOrden() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateOrdenPayload) => createOrden(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ordenes"] });
    },
  });
}
