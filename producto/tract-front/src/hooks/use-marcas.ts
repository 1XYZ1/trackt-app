"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMarca,
  desactivarMarca,
  getMarcas,
  reactivarMarca,
  updateMarca,
  type CreateMarcaPayload,
  type MarcasFilters,
  type UpdateMarcaPayload,
} from "@/lib/api/marcas";

export function useMarcas(filters: MarcasFilters = {}) {
  return useQuery({
    queryFn: () => getMarcas(filters),
    queryKey: ["marcas", filters],
  });
}

export function useCreateMarca() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateMarcaPayload) => createMarca(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["marcas"] });
    },
  });
}

export function useUpdateMarca() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateMarcaPayload }) =>
      updateMarca(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["marcas"] });
    },
  });
}

export function useDesactivarMarca() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => desactivarMarca(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["marcas"] });
    },
  });
}

export function useReactivarMarca() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reactivarMarca(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["marcas"] });
    },
  });
}
