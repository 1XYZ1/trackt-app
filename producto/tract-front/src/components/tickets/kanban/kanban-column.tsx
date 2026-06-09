"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { StatusBadge, type TicketEstado } from "@/components/core";
import { cn } from "@/lib/utils";

/**
 * Columna del kanban (un estado). `dimmed` la atenúa cuando, durante un drag, no
 * es un destino válido para el ticket/rol actual; `disabled` desactiva el drop.
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
        "flex min-w-64 flex-1 flex-col rounded-lg border border-border/60 bg-muted/20 transition-opacity",
        dimmed && "pointer-events-none opacity-40",
      )}
      ref={setNodeRef}
    >
      <div className="flex items-center justify-between gap-2 border-border/60 border-b px-3 py-2">
        <StatusBadge estado={estado} />
        <span className="text-muted-foreground text-xs">{count}</span>
      </div>
      <div
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-b-lg p-2 transition-colors",
          isOver && !disabled && "bg-brand-primary/10 ring-1 ring-brand-primary/40 ring-inset",
        )}
      >
        {children}
      </div>
    </div>
  );
}
