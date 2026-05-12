import { ClipboardList, Ticket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";
import type { OtResumen } from "./types";

export interface OtCardProps {
  ot: OtResumen;
  className?: string;
}

/**
 * Card resumida para ordenes de trabajo con estado y contador de tickets asociados.
 *
 * @example
 * <OtCard ot={{ codigo: "OT-10482", equipo: "CAT 793F", descripcion: "Cambio de bomba", estado: "EN_EJECUCION", ticketsCount: 3 }} />
 */
export function OtCard({ className, ot }: OtCardProps) {
  return (
    <Card className={cn("rounded-lg border-border/70", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono font-semibold text-muted-foreground text-xs">
              {ot.codigo}
            </p>
            <h3 className="mt-1 flex items-center gap-2 truncate font-semibold text-sm">
              <ClipboardList className="size-4 shrink-0 text-brand-primary" />
              <span className="truncate">{ot.equipo}</span>
            </h3>
          </div>
          <StatusBadge estado={ot.estado} />
        </div>

        <p className="mt-3 line-clamp-2 text-muted-foreground text-sm">
          {ot.descripcion}
        </p>

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 font-medium text-secondary-foreground text-xs">
          <Ticket className="size-3.5" />
          {ot.ticketsCount} ticket{ot.ticketsCount === 1 ? "" : "s"}
        </div>
      </CardContent>
    </Card>
  );
}
