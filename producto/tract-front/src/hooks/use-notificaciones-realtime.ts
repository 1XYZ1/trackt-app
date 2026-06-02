"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { NotificacionPayload } from "@/lib/api/notificaciones";

/**
 * Suscribe al canal Realtime filtrado por usuario_id. Al recibir INSERT
 * dispara toast con el mensaje del payload e invalida queries del bell.
 *
 * Resiliencia: si el WebSocket de Realtime no conecta (red del taller que
 * bloquea wss, Realtime deshabilitado, tabla fuera de la publicacion...),
 * tras unos reintentos se remueve el canal para cortar el storm de
 * reconexion en consola. Las notificaciones siguen vivas via el polling de
 * 60s en use-notificaciones (count + lista).
 *
 * Kill switch: NEXT_PUBLIC_DISABLE_REALTIME="true" desactiva Realtime por
 * completo (solo polling) — util en redes que bloquean WebSockets.
 *
 * Cleanup: removeChannel al desmontar para evitar memory leak.
 */
const MAX_FALLOS = 2;

export function useNotificacionesRealtime(userId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    if (process.env.NEXT_PUBLIC_DISABLE_REALTIME === "true") return;

    const supabase = createClient();
    let fallos = 0;
    let activo = true;

    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificaciones",
          filter: `usuario_id=eq.${userId}`,
        },
        (payload: { new: { payload?: NotificacionPayload } }) => {
          const mensaje = payload.new?.payload?.mensaje ?? "Nueva notificacion";
          toast.info(mensaje);
          queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
        },
      )
      .subscribe((status) => {
        if (!activo) return;
        if (status === "SUBSCRIBED") {
          fallos = 0;
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          fallos += 1;
          if (fallos >= MAX_FALLOS) {
            // Realtime no disponible: cortar reintentos y caer a polling.
            activo = false;
            supabase.removeChannel(channel);
          }
        }
      });

    return () => {
      activo = false;
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
