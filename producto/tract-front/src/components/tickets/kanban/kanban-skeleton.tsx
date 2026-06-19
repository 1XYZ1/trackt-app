import { ticketEstadoLabel, type TicketEstado } from "@/components/core/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ESTADO_DOT } from "@/lib/tickets/format";
import { cn } from "@/lib/utils";

// Mismas columnas visibles que tickets-kanban.tsx.
const COLUMNAS: TicketEstado[] = [
  "PENDIENTE",
  "ASIGNADO",
  "EN_EJECUCION",
  "EJECUTADO",
  "CERRADO",
];

/**
 * Placeholder del board kanban: 5 columnas con header (dot + label + count) y
 * cards. Calca la estructura de `tickets-kanban.tsx` / `kanban-column.tsx` para
 * que el `loading.tsx` de /tickets y el `isLoading` del cliente coincidan.
 * Server-safe (solo imports puros).
 */
export function KanbanSkeleton() {
  return (
    <div className="grid h-full min-h-0 grid-flow-col auto-cols-[minmax(13.5rem,1fr)] gap-2 overflow-x-auto xl:grid-cols-5 xl:overflow-x-hidden">
      {COLUMNAS.map((estado, colIdx) => (
        <div
          className="flex min-h-0 flex-col rounded-lg border border-transparent bg-muted/30"
          key={estado}
        >
          <div className="flex items-center gap-2 rounded-t-lg bg-muted/30 px-2.5 py-2">
            <span
              className={cn("size-2 shrink-0 rounded-full", ESTADO_DOT[estado])}
            />
            <span className="font-semibold text-foreground text-sm">
              {ticketEstadoLabel(estado)}
            </span>
            <Skeleton className="ml-auto h-5 w-5 rounded-full" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-1.5">
            {Array.from({ length: 4 - (colIdx % 2) }).map((_, idx) => (
              <Skeleton className="h-20 rounded-lg" key={idx} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
