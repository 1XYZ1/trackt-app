import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback genérico para cualquier ruta de (app) que no defina su propio
 * loading.tsx. Las rutas con loading.tsx específico lo sobreescriben. Garantiza
 * que toda navegación muestre algo al instante (sin congelar la página previa).
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Card>
        <CardContent className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton className="h-8 w-full" key={idx} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
