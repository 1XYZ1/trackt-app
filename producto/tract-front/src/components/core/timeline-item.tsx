import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";
import type { TimelineEvento } from "./types";
import { UserAvatar } from "./user-avatar";

export interface TimelineItemProps {
  evento: TimelineEvento;
  className?: string;
}

/**
 * Item visual para historiales de tickets y OT: cambio de estado, comentario o accion operativa.
 *
 * @example
 * <TimelineItem evento={{ id: "1", titulo: "Estado actualizado", estado: "ASIGNADO", fecha: "Hoy 09:30" }} />
 */
export function TimelineItem({ className, evento }: TimelineItemProps) {
  return (
    <div className={cn("relative flex gap-3", className)}>
      <div className="flex flex-col items-center">
        <span className="mt-1 flex size-6 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary ring-1 ring-inset ring-brand-primary/25">
          <Circle className="size-2.5 fill-current" />
        </span>
        <span className="mt-2 h-full min-h-8 w-px bg-border" />
      </div>

      <div className="min-w-0 flex-1 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-sm text-foreground">{evento.titulo}</p>
          {evento.estado && <StatusBadge estado={evento.estado} showIcon={false} />}
        </div>
        {evento.descripcion && (
          <p className="mt-1 text-muted-foreground text-sm">{evento.descripcion}</p>
        )}
        <div className="mt-3 flex items-center gap-2 text-muted-foreground text-xs">
          <UserAvatar className="size-6" user={evento.usuario} />
          <span>{evento.usuario?.nombre || evento.usuario?.email || "Sistema"}</span>
          <span aria-hidden="true">-</span>
          <time>{evento.fecha}</time>
        </div>
      </div>
    </div>
  );
}
