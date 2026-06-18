"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addEquipoRepuesto,
  createEquipo,
  desactivarEquipo,
  generarQr,
  getEquipo,
  getEquipoHistorial,
  getEquipoRepuestos,
  getEquipoResumen,
  getEquipos,
  reactivarEquipo,
  removeEquipoRepuesto,
  updateEquipo,
  type AddEquipoRepuestoPayload,
  type CreateEquipoPayload,
  type EquiposFilters,
  type HistorialFiltros,
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

export function useEquipoHistorial(id: string, filtros: HistorialFiltros = {}) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => getEquipoHistorial(id, filtros),
    queryKey: ["equipos", "historial", id, filtros],
  });
}

export function useGenerarQr() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => generarQr(id),
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({
        queryKey: ["equipos", "detalle", id],
      });
    },
  });
}

export function useEquipoRepuestos(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => getEquipoRepuestos(id),
    queryKey: ["equipos", "repuestos", id],
  });
}

export function useAddEquipoRepuesto(equipoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddEquipoRepuestoPayload) =>
      addEquipoRepuesto(equipoId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["equipos", "repuestos", equipoId],
      });
    },
  });
}

export function useRemoveEquipoRepuesto(equipoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (repuestoId: string) =>
      removeEquipoRepuesto(equipoId, repuestoId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["equipos", "repuestos", equipoId],
      });
    },
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
