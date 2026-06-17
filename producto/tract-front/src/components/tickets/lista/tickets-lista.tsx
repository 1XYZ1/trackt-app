"use client";

import { ChevronRight } from "lucide-react";
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

  const grupos = TICKET_ESTADOS.map((estado) => ({
    estado,
    items: tickets.filter((t) => t.estado === estado),
  })).filter((g) => g.items.length > 0);

  if (grupos.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {grupos.map(({ estado, items }) => (
        <Collapsible
          defaultOpen={!COLAPSADOS_POR_DEFECTO.includes(estado)}
          key={estado}
        >
          <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/40">
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90" />
            <span className={cn("size-2 rounded-full", ESTADO_DOT[estado])} />
            <span className="font-semibold text-sm">
              {ticketEstadoLabel(estado)}
            </span>
            <span className="text-muted-foreground text-xs">{items.length}</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="divide-y divide-border/50 border-border/50 border-t">
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
