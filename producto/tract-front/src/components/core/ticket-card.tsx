import { Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";
import type { TicketResumen } from "./types";
import { UserAvatar } from "./user-avatar";

export interface TicketCardProps {
  ticket: TicketResumen;
  className?: string;
}

/**
 * Card compacta para mostrar tickets ITCM en listados, dashboards y relaciones con OT.
 *
 * @example
 * <TicketCard ticket={{ codigo: "ITCM-001", titulo: "Fuga hidraulica", equipo: "CAT 793F", estado: "ASIGNADO" }} />
 */
export function TicketCard({ className, ticket }: TicketCardProps) {
  const mechanicLabel = ticket.mecanico?.nombre || ticket.mecanico?.email || "Sin mecanico";

  return (
    <Card className={cn("rounded-lg border-border/70", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono font-semibold text-muted-foreground text-xs">
              {ticket.codigo}
            </p>
            <h3 className="mt-1 truncate font-semibold text-sm text-foreground">
              {ticket.titulo}
            </h3>
          </div>
          <StatusBadge estado={ticket.estado} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs">
            <Wrench className="size-3.5 shrink-0" />
            <span className="truncate">{ticket.equipo}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <UserAvatar className="size-7" user={ticket.mecanico} />
            <span className="max-w-28 truncate text-muted-foreground text-xs">
              {mechanicLabel}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
