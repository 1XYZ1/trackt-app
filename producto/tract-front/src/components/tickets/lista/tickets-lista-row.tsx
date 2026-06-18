"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/core";
import {
  getTicketEquipoLabel,
  type TicketTrabajo,
} from "@/lib/api/tickets";
import {
  formatRelativeDate,
  PRIORIDAD_DOT,
  PRIORIDAD_LABEL,
} from "@/lib/tickets/format";
import { cn } from "@/lib/utils";

/**
 * Fila densa estilo Linear para la vista lista. Toda la fila es un Link al
 * detalle, con prefetch de datos en hover.
 */
export function TicketsListaRow({
  ticket,
  onHover,
}: {
  ticket: TicketTrabajo;
  onHover?: (id: string) => void;
}) {
  const mecanicoLabel =
    ticket.mecanico?.nombre || ticket.mecanico?.email || "Sin mecanico";

  return (
    <Link
      className="group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      href={`/tickets/${ticket.id}`}
      onMouseEnter={() => onHover?.(ticket.id)}
    >
      <span
        aria-label={`Prioridad ${PRIORIDAD_LABEL[ticket.prioridad]}`}
        className={cn(
          "size-2 shrink-0 rounded-full ring-2 ring-background",
          PRIORIDAD_DOT[ticket.prioridad],
        )}
        title={`Prioridad ${PRIORIDAD_LABEL[ticket.prioridad]}`}
      />
      <span className="w-20 shrink-0 truncate font-mono text-muted-foreground text-xs tracking-tight sm:w-24">
        {ticket.codigo}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-foreground transition-colors group-hover:text-foreground">
        {ticket.titulo}
      </span>
      <span className="hidden w-40 shrink-0 truncate text-muted-foreground text-xs md:block">
        {getTicketEquipoLabel(ticket)}
      </span>
      <div className="hidden w-36 shrink-0 items-center gap-1.5 lg:flex">
        <UserAvatar className="size-5" user={ticket.mecanico} />
        <span className="truncate text-muted-foreground text-xs">
          {mecanicoLabel}
        </span>
      </div>
      <time
        className="w-16 shrink-0 text-right text-muted-foreground text-xs tabular-nums"
        dateTime={ticket.createdAt}
      >
        {formatRelativeDate(ticket.createdAt)}
      </time>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/60" />
    </Link>
  );
}
