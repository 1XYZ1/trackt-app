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
  empty,
  dimmed,
  disabled,
  droppable,
}: {
  estado: TicketEstado;
  count: number;
  children: ReactNode;
  /** true cuando la columna no tiene cards (para mostrar placeholder). */
  empty?: boolean;
  dimmed?: boolean;
  disabled?: boolean;
  /** Destino válido durante un drag activo: resalta el borde sutilmente. */
  droppable?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado, disabled });

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col rounded-lg border border-transparent bg-muted/30 transition-[opacity,border-color]",
        dimmed && "pointer-events-none opacity-40",
        droppable && !isOver && "border-dashed border-border",
      )}
      ref={setNodeRef}
    >
      <div className="flex items-center gap-2 rounded-t-lg bg-muted/30 px-2.5 py-2 backdrop-blur-sm">
        <span
          className={cn("size-2 shrink-0 rounded-full", ESTADO_DOT[estado])}
        />
        <span className="font-semibold text-foreground text-sm">
          {ticketEstadoLabel(estado)}
        </span>
        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 font-medium text-muted-foreground text-xs tabular-nums">
          {count}
        </span>
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 rounded-b-lg p-1.5 transition-colors [scrollbar-width:thin]",
          empty ? "overflow-hidden" : "overflow-y-auto",
          isOver &&
            !disabled &&
            "bg-brand-primary/10 ring-1 ring-brand-primary/40 ring-inset",
        )}
      >
        {empty ? (
          <div
            className={cn(
              "flex flex-1 items-center justify-center rounded-md border border-dashed border-border/60 p-3 text-center text-muted-foreground/70 text-xs transition-colors",
              isOver && !disabled && "border-brand-primary/50 text-brand-primary",
            )}
          >
            {isOver && !disabled ? "Soltar aquí" : "Sin tickets"}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
