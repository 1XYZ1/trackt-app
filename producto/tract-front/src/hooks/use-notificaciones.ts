"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCountNoLeidas,
  getNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
} from "@/lib/api/notificaciones";

export function useNotificaciones(limit = 10) {
  return useQuery({
    queryFn: () => getNotificaciones({ limit }),
    queryKey: ["notificaciones", { limit }],
    refetchInterval: 60_000, // fallback poll por si Realtime se cae
  });
}

export function useCountNoLeidas() {
  return useQuery({
    queryFn: getCountNoLeidas,
    queryKey: ["notificaciones", "count-no-leidas"],
    refetchInterval: 60_000, // fallback poll por si Realtime se cae
  });
}

export function useMarcarLeida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: marcarLeida,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
    },
  });
}

export function useMarcarTodasLeidas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: marcarTodasLeidas,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
    },
  });
}
