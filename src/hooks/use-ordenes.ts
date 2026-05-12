"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOrden,
  getOrdenById,
  getOrdenes,
  type CreateOrdenPayload,
  type OrdenesFilters,
} from "@/lib/api/ordenes";

export function useOrdenes(filters?: OrdenesFilters) {
  return useQuery({
    queryFn: getOrdenes,
    queryKey: ["ordenes", filters ?? {}],
  });
}

export function useOrden(id?: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => getOrdenById(id as string),
    queryKey: ["ordenes", id],
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
