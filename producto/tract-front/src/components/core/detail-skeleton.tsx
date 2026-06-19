import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  /** "two-col" para detalles de escritorio (ticket/orden/equipo/repuesto);
   * "mobile" para la ficha móvil de ejecución (mis-tickets). */
  variant?: "two-col" | "mobile";
  /** Renderiza una fila de tabs (equipo) bajo el encabezado. */
  tabs?: boolean;
}

/**
 * Placeholder de página de detalle: botón volver + encabezado + paneles. Comparte
 * la forma con los `*-detalle-client.tsx` para que el `loading.tsx` y el
 * `isLoading` del cliente coincidan. Server-safe.
 */
export function DetailSkeleton({ variant = "two-col", tabs = false }: Props) {
  if (variant === "mobile") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Skeleton className="h-8 w-32" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full max-w-3xl" />
      </div>
      {tabs && (
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton className="h-9 w-28" key={idx} />
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}
