"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { ticketEstadoLabel, type TicketEstado } from "@/components/core";
import { ESTADO_DOT } from "@/lib/tickets/format";
import { cn } from "@/lib/utils";

/**
 * Columna del kanban (un estado), estilo Linear: header con dot+label+count y
 * cuerpo con scroll vertical propio (clave del layout de viewport fijo — la
 * página no scrollea, cada columna sí). `dimmed`/`disabled` la atenúan y
 * desactivan el drop cuando no es destino válido durante un drag.
 */
export function KanbanColumn({
  estado,
  count,
  children,
  dimmed,
  disabled,
}: {
  estado: TicketEstado;
  count: number;
  children: ReactNode;
  dimmed?: boolean;
  disabled?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado, disabled });

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col rounded-lg bg-muted/20 transition-opacity",
        dimmed && "pointer-events-none opacity-40",
      )}
      ref={setNodeRef}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className={cn("size-2 shrink-0 rounded-full", ESTADO_DOT[estado])} />
        <span className="font-semibold text-sm">{ticketEstadoLabel(estado)}</span>
        <span className="text-muted-foreground text-xs">{count}</span>
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-b-lg p-1.5 [scrollbar-width:thin]",
          isOver && !disabled && "bg-brand-primary/10 ring-1 ring-brand-primary/40 ring-inset",
        )}
      >
        {children}
      </div>
    </div>
  );
}
