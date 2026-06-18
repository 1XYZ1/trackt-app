"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelarProgramacion,
  createProgramacion,
  generarOt,
  getCalendario,
  getProgramacion,
  getProgramaciones,
  updateProgramacion,
  type CreateProgramacionPayload,
  type GenerarOtPayload,
  type ProgramacionesFilters,
  type UpdateProgramacionPayload,
} from "@/lib/api/programaciones";

export function useProgramaciones(filters: ProgramacionesFilters = {}) {
  return useQuery({
    queryFn: () => getProgramaciones(filters),
    queryKey: ["programaciones", filters],
  });
}

export function useCalendario(desde: string, hasta: string) {
  return useQuery({
    enabled: Boolean(desde && hasta),
    queryFn: () => getCalendario(desde, hasta),
    queryKey: ["programaciones", "calendario", desde, hasta],
  });
}

export function useProgramacion(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => getProgramacion(id),
    queryKey: ["programaciones", "detalle", id],
  });
}

export function useCreateProgramacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProgramacionPayload) =>
      createProgramacion(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["programaciones"] });
    },
  });
}

export function useUpdateProgramacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateProgramacionPayload;
    }) => updateProgramacion(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["programaciones"] });
    },
  });
}

export function useCancelarProgramacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelarProgramacion(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["programaciones"] });
    },
  });
}

export function useGenerarOt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: GenerarOtPayload }) =>
      generarOt(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["programaciones"] });
      await queryClient.invalidateQueries({ queryKey: ["ordenes"] });
    },
  });
}
