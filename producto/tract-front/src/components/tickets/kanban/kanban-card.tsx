"use client";

import { useDraggable } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";
import { UserAvatar } from "@/components/core";
import { usePrefetchTicket } from "@/hooks/use-tickets";
import { getTicketEquipoLabel, type TicketTrabajo } from "@/lib/api/tickets";
import { PRIORIDAD_DOT, PRIORIDAD_LABEL } from "@/lib/tickets/format";
import { cn } from "@/lib/utils";

/**
 * Contenido visual de una card del kanban (denso, estilo Linear). Separado de la
 * lógica de drag para reusarlo tal cual en el DragOverlay.
 */
export function KanbanCardContent({
  ticket,
  className,
}: {
  ticket: TicketTrabajo;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-md border border-border/60 bg-card p-2.5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">
          {ticket.codigo}
        </span>
        <UserAvatar
          className="size-5 shrink-0"
          user={ticket.mecanico}
        />
      </div>
      <h3 className="line-clamp-2 font-medium text-foreground text-sm leading-snug">
        {ticket.titulo}
      </h3>
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span className="flex shrink-0 items-center gap-1">
          <span
            className={cn("size-1.5 rounded-full", PRIORIDAD_DOT[ticket.prioridad])}
          />
          {PRIORIDAD_LABEL[ticket.prioridad]}
        </span>
        <span className="text-border">·</span>
        <span className="flex min-w-0 items-center gap-1">
          <Wrench className="size-3 shrink-0" />
          <span className="truncate">{getTicketEquipoLabel(ticket)}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Card arrastrable del kanban. Si `draggable` es false (sin transiciones válidas
 * para el usuario), no registra listeners de drag y solo navega al detalle.
 * Un click sin movimiento navega (activationConstraint distance:8 en el sensor).
 */
export function KanbanCard({
  ticket,
  draggable,
}: {
  ticket: TicketTrabajo;
  draggable: boolean;
}) {
  const router = useRouter();
  const prefetch = usePrefetchTicket();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ticket.id,
    data: { ticket },
    disabled: !draggable,
  });

  return (
    <div
      className={cn(
        "rounded-md transition-colors",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
      onClick={() => router.push(`/tickets/${ticket.id}`)}
      onMouseEnter={() => prefetch(ticket.id)}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
    >
      <KanbanCardContent
        className="hover:border-brand-primary/40"
        ticket={ticket}
      />
    </div>
  );
}
