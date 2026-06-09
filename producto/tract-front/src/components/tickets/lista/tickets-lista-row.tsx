"use client";

import Link from "next/link";
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
      className="flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted/50"
      href={`/tickets/${ticket.id}`}
      onMouseEnter={() => onHover?.(ticket.id)}
    >
      <span
        aria-label={`Prioridad ${PRIORIDAD_LABEL[ticket.prioridad]}`}
        className={cn(
          "size-2 shrink-0 rounded-full",
          PRIORIDAD_DOT[ticket.prioridad],
        )}
        title={`Prioridad ${PRIORIDAD_LABEL[ticket.prioridad]}`}
      />
      <span className="w-24 shrink-0 truncate font-mono text-muted-foreground text-xs">
        {ticket.codigo}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
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
      <span className="w-16 shrink-0 text-right text-muted-foreground text-xs">
        {formatRelativeDate(ticket.createdAt)}
      </span>
    </Link>
  );
}
