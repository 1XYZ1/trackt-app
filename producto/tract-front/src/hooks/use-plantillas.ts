"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addPlantillaItem,
  createPlantilla,
  desactivarPlantilla,
  getPlantilla,
  getPlantillas,
  reactivarPlantilla,
  removePlantillaItem,
  updatePlantilla,
  updatePlantillaItem,
  type AddPlantillaItemPayload,
  type CreatePlantillaPayload,
  type PlantillasFilters,
  type UpdatePlantillaItemPayload,
  type UpdatePlantillaPayload,
} from "@/lib/api/plantillas";

export function usePlantillas(filters: PlantillasFilters = {}) {
  return useQuery({
    queryFn: () => getPlantillas(filters),
    queryKey: ["plantillas", filters],
  });
}

export function usePlantilla(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => getPlantilla(id),
    queryKey: ["plantillas", "detalle", id],
  });
}

export function useCreatePlantilla() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePlantillaPayload) => createPlantilla(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["plantillas"] });
    },
  });
}

export function useUpdatePlantilla() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdatePlantillaPayload;
    }) => updatePlantilla(id, payload),
    onSuccess: async (_data, { id }) => {
      await queryClient.invalidateQueries({ queryKey: ["plantillas"] });
      await queryClient.invalidateQueries({
        queryKey: ["plantillas", "detalle", id],
      });
    },
  });
}

export function useDesactivarPlantilla() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => desactivarPlantilla(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["plantillas"] });
    },
  });
}

export function useReactivarPlantilla() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reactivarPlantilla(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["plantillas"] });
    },
  });
}

function useInvalidatePlantilla(plantillaId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: ["plantillas", "detalle", plantillaId],
    });
}

export function useAddPlantillaItem(plantillaId: string) {
  const invalidate = useInvalidatePlantilla(plantillaId);
  return useMutation({
    mutationFn: (payload: AddPlantillaItemPayload) =>
      addPlantillaItem(plantillaId, payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdatePlantillaItem(plantillaId: string) {
  const invalidate = useInvalidatePlantilla(plantillaId);
  return useMutation({
    mutationFn: ({
      itemId,
      payload,
    }: {
      itemId: string;
      payload: UpdatePlantillaItemPayload;
    }) => updatePlantillaItem(plantillaId, itemId, payload),
    onSuccess: () => invalidate(),
  });
}

export function useRemovePlantillaItem(plantillaId: string) {
  const invalidate = useInvalidatePlantilla(plantillaId);
  return useMutation({
    mutationFn: (itemId: string) => removePlantillaItem(plantillaId, itemId),
    onSuccess: () => invalidate(),
  });
}
