"use client";

import { useDraggable } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import type React from "react";
import { CalendarClock, GripVertical, Wrench } from "lucide-react";
import { UserAvatar } from "@/components/core";
import { usePrefetchTicket } from "@/hooks/use-tickets";
import { getTicketEquipoLabel, type TicketTrabajo } from "@/lib/api/tickets";
import {
  formatRelativeDate,
  PRIORIDAD_DOT,
  PRIORIDAD_LABEL,
} from "@/lib/tickets/format";
import { cn } from "@/lib/utils";

/**
 * Contenido visual de una card del kanban (denso, estilo Linear). Separado de la
 * lógica de drag para reusarlo tal cual en el DragOverlay.
 */
export function KanbanCardContent({
  ticket,
  className,
  draggable,
}: {
  ticket: TicketTrabajo;
  className?: string;
  draggable?: boolean;
}) {
  const mecanicoLabel =
    ticket.mecanico?.nombre || ticket.mecanico?.email || "Sin asignar";

  return (
    <div
      className={cn(
        "group/card flex flex-col gap-2 rounded-md border border-border/60 bg-card p-2.5 shadow-xs/5 transition-colors",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1">
          {draggable && (
            <GripVertical className="-ml-0.5 size-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover/card:text-muted-foreground/70" />
          )}
          <span className="truncate font-mono text-[11px] text-muted-foreground tracking-tight">
            {ticket.codigo}
          </span>
        </span>
        <UserAvatar className="size-5 shrink-0" user={ticket.mecanico} />
      </div>

      <h3 className="line-clamp-2 font-medium text-foreground text-sm leading-snug">
        {ticket.titulo}
      </h3>

      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <span
          className="flex shrink-0 items-center gap-1 font-medium"
          title={`Prioridad ${PRIORIDAD_LABEL[ticket.prioridad]}`}
        >
          <span
            className={cn("size-1.5 rounded-full", PRIORIDAD_DOT[ticket.prioridad])}
          />
          {PRIORIDAD_LABEL[ticket.prioridad]}
        </span>
        <span aria-hidden className="text-border">
          ·
        </span>
        <span className="flex min-w-0 items-center gap-1">
          <Wrench className="size-3 shrink-0" />
          <span className="truncate">{getTicketEquipoLabel(ticket)}</span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 border-border/40 border-t pt-2 text-[11px] text-muted-foreground">
        <span className="min-w-0 truncate" title={mecanicoLabel}>
          {mecanicoLabel}
        </span>
        {ticket.createdAt && (
          <span className="flex shrink-0 items-center gap-1">
            <CalendarClock className="size-3" />
            <time dateTime={ticket.createdAt}>
              {formatRelativeDate(ticket.createdAt)}
            </time>
          </span>
        )}
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

  const goToDetail = () => router.push(`/tickets/${ticket.id}`);

  // Cuando la card es arrastrable, dnd-kit aporta sus propios role/tabIndex vía
  // `attributes` (no los duplicamos). Cuando no lo es, la volvemos navegable por
  // teclado nosotros mismos.
  const keyboardProps = draggable
    ? {}
    : {
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            goToDetail();
          }
        },
        role: "button" as const,
        tabIndex: 0,
      };

  return (
    <div
      aria-label={`Abrir ticket ${ticket.codigo}: ${ticket.titulo}`}
      className={cn(
        "rounded-md outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
      onClick={goToDetail}
      onMouseEnter={() => prefetch(ticket.id)}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      {...keyboardProps}
    >
      <KanbanCardContent
        className="hover:border-brand-primary/50 hover:bg-accent/30"
        draggable={draggable}
        ticket={ticket}
      />
    </div>
  );
}
