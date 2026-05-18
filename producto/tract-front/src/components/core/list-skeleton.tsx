import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  count?: number;
  columns?: 1 | 2;
}

/**
 * Placeholder de lista de tarjetas mientras carga la data.
 * Sustituye spinners (Loader2) para mejorar percepción de velocidad.
 */
export function ListSkeleton({ count = 4, columns = 2 }: Props) {
  const grid = columns === 2 ? "xl:grid-cols-2" : "";
  return (
    <div className={`grid gap-4 ${grid}`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          className="space-y-3 rounded-lg border border-border/70 p-4"
          key={idx}
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="ml-auto h-5 w-12" />
          </div>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
