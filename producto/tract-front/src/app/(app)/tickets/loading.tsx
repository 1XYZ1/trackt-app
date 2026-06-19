import { KanbanSkeleton } from "@/components/tickets/kanban/kanban-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Fallback instantáneo de /tickets: toolbar + board kanban (vista por defecto).
// Habilita además el prefetch del shell de esta ruta dinámica.
export default function Loading() {
  return (
    <div className="flex h-[calc(100svh-10.5rem)] min-h-[28rem] flex-col gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-full sm:w-56" />
          <Skeleton className="h-8 w-full sm:w-40" />
          <Skeleton className="h-8 w-full sm:w-32" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <KanbanSkeleton />
      </div>
    </div>
  );
}
