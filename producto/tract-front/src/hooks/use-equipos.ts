"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createEquipo,
  desactivarEquipo,
  getEquipo,
  getEquipoResumen,
  getEquipos,
  reactivarEquipo,
  updateEquipo,
  type CreateEquipoPayload,
  type EquiposFilters,
  type UpdateEquipoPayload,
} from "@/lib/api/equipos";

export function useEquipos(filters: EquiposFilters = {}) {
  return useQuery({
    queryFn: () => getEquipos(filters),
    queryKey: ["equipos", filters],
  });
}

export function useEquipo(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => getEquipo(id),
    queryKey: ["equipos", "detalle", id],
  });
}

export function useEquipoResumen(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => getEquipoResumen(id),
    queryKey: ["equipos", "resumen", id],
  });
}

export function useCreateEquipo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateEquipoPayload) => createEquipo(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["equipos"] });
    },
  });
}

export function useUpdateEquipo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateEquipoPayload;
    }) => updateEquipo(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["equipos"] });
    },
  });
}

export function useDesactivarEquipo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => desactivarEquipo(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["equipos"] });
    },
  });
}

export function useReactivarEquipo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reactivarEquipo(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["equipos"] });
    },
  });
}
