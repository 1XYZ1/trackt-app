"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addTipoEquipoRepuesto,
  createTipoEquipo,
  desactivarTipoEquipo,
  getTipoEquipo,
  getTipoEquipoRepuestos,
  getTiposEquipo,
  reactivarTipoEquipo,
  removeTipoEquipoRepuesto,
  updateTipoEquipo,
  type AddTipoEquipoRepuestoPayload,
  type CreateTipoEquipoPayload,
  type TiposEquipoFilters,
  type UpdateTipoEquipoPayload,
} from "@/lib/api/tipos-equipo";

export function useTiposEquipo(filters: TiposEquipoFilters = {}) {
  return useQuery({
    queryFn: () => getTiposEquipo(filters),
    queryKey: ["tipos-equipo", filters],
  });
}

export function useTipoEquipo(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => getTipoEquipo(id),
    queryKey: ["tipos-equipo", "detalle", id],
  });
}

export function useCreateTipoEquipo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTipoEquipoPayload) => createTipoEquipo(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tipos-equipo"] });
    },
  });
}

export function useUpdateTipoEquipo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateTipoEquipoPayload;
    }) => updateTipoEquipo(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tipos-equipo"] });
    },
  });
}

export function useDesactivarTipoEquipo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => desactivarTipoEquipo(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tipos-equipo"] });
    },
  });
}

export function useReactivarTipoEquipo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reactivarTipoEquipo(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tipos-equipo"] });
    },
  });
}

export function useTipoEquipoRepuestos(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => getTipoEquipoRepuestos(id),
    queryKey: ["tipos-equipo", "repuestos", id],
  });
}

export function useAddTipoEquipoRepuesto(tipoEquipoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddTipoEquipoRepuestoPayload) =>
      addTipoEquipoRepuesto(tipoEquipoId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tipos-equipo", "repuestos", tipoEquipoId],
      });
    },
  });
}

export function useRemoveTipoEquipoRepuesto(tipoEquipoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (repuestoId: string) =>
      removeTipoEquipoRepuesto(tipoEquipoId, repuestoId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tipos-equipo", "repuestos", tipoEquipoId],
      });
    },
  });
}
