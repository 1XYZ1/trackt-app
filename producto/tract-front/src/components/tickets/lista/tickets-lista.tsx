"use client";

import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import {
  TICKET_ESTADOS,
  ticketEstadoLabel,
  type TicketEstado,
} from "@/components/core";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { usePrefetchTicket } from "@/hooks/use-tickets";
import type { TicketTrabajo } from "@/lib/api/tickets";
import { ESTADO_DOT } from "@/lib/tickets/format";
import { cn } from "@/lib/utils";
import { TicketsListaRow } from "./tickets-lista-row";

// Grupos terminales colapsados por defecto para reducir ruido visual.
const COLAPSADOS_POR_DEFECTO: TicketEstado[] = ["CERRADO", "CANCELADO"];

/**
 * Vista lista estilo Linear: tickets agrupados por estado en orden de workflow,
 * con headers colapsables y filas densas. Recibe los tickets ya filtrados por
 * búsqueda/mecánico/OT.
 */
export function TicketsLista({ tickets }: { tickets: TicketTrabajo[] }) {
  const prefetch = usePrefetchTicket();

  const grupos = useMemo(
    () =>
      TICKET_ESTADOS.map((estado) => ({
        estado,
        items: tickets.filter((t) => t.estado === estado),
      })).filter((g) => g.items.length > 0),
    [tickets],
  );

  if (grupos.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
      {grupos.map(({ estado, items }, index) => (
        <Collapsible
          className={cn(index > 0 && "border-border/60 border-t")}
          defaultOpen={!COLAPSADOS_POR_DEFECTO.includes(estado)}
          key={estado}
        >
          <CollapsibleTrigger className="group sticky top-0 z-10 flex w-full items-center gap-2 bg-muted/40 px-3 py-2 text-left outline-none backdrop-blur-sm transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90" />
            <span className={cn("size-2 rounded-full", ESTADO_DOT[estado])} />
            <span className="font-semibold text-foreground text-sm">
              {ticketEstadoLabel(estado)}
            </span>
            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 font-medium text-muted-foreground text-xs tabular-nums">
              {items.length}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-col gap-px p-1">
              {items.map((ticket) => (
                <TicketsListaRow
                  key={ticket.id}
                  onHover={prefetch}
                  ticket={ticket}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
