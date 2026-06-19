import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  rows?: number;
  cols?: number;
}

/**
 * Placeholder de tabla (filas con celdas) mientras carga la data. Comparte la
 * forma con las tablas de equipos / inventario / plantillas / marcas para que el
 * skeleton del `loading.tsx` y el de `isLoading` del cliente coincidan (sin doble
 * flash). Server-safe (sin hooks ni "use client").
 */
export function TableSkeleton({ rows = 6, cols = 6 }: Props) {
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div className="flex items-center gap-4 px-5 py-3.5" key={rowIdx}>
          {Array.from({ length: cols }).map((__, colIdx) => (
            <Skeleton
              className="h-4"
              key={colIdx}
              style={{
                width: `${colIdx === 0 ? 64 : 80 + ((colIdx * 13) % 60)}px`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
