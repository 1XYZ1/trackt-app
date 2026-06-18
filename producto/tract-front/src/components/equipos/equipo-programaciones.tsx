"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/core";
// Import directo (no barrel) para evitar ciclo equipos <-> programaciones.
import {
  PrioridadBadge,
  ProgramacionEstadoBadge,
} from "@/components/programaciones/programacion-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProgramaciones } from "@/hooks/use-programaciones";

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export type EquipoProgramacionesProps = {
  equipoId: string;
};

export function EquipoProgramaciones({ equipoId }: EquipoProgramacionesProps) {
  const { data: programaciones = [], error, isLoading } = useProgramaciones({
    equipoId,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 pb-3">
        <CardTitle className="text-base">Programaciones del equipo</CardTitle>
        <Button render={<Link href="/mantenciones" />} size="sm" variant="outline">
          <CalendarDays />
          Ver calendario
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && (
          <div className="space-y-2.5 p-5">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton className="h-10 w-full" key={idx} />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="p-5">
            <EmptyState
              icon="wrench"
              message="No se pudieron cargar las programaciones del equipo."
              title="Error al cargar"
            />
          </div>
        )}

        {!isLoading && !error && programaciones.length === 0 && (
          <div className="p-5">
            <EmptyState
              icon="wrench"
              message="Este equipo no tiene programaciones de mantenimiento."
              title="Sin programaciones"
            />
          </div>
        )}

        {!isLoading && !error && programaciones.length > 0 && (
          <div className="divide-y divide-border/60">
            {programaciones.map((p) => (
              <div
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent/40"
                key={p.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{p.titulo}</p>
                  <p className="text-muted-foreground text-xs">
                    {fmtFecha(p.fechaProgramada)}
                    {p.plantilla ? ` · ${p.plantilla.nombre}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <PrioridadBadge prioridad={p.prioridad} />
                  <ProgramacionEstadoBadge estado={p.estado} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
