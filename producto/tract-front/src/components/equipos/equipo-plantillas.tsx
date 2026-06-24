"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarPlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/core";
import { PlantillaSelect } from "@/components/plantillas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasRole } from "@/contexts/auth-context";
import {
  useAddEquipoPlantilla,
  useEquipoPlantillas,
  useRemoveEquipoPlantilla,
} from "@/hooks/use-equipos";

export type EquipoPlantillasProps = {
  equipoId: string;
};

export function EquipoPlantillas({ equipoId }: EquipoPlantillasProps) {
  const isAdmin = useHasRole("admin");
  const isJefe = useHasRole("jefe_taller");
  const canManage = isAdmin || isJefe;

  const { data: asociadas = [], error, isLoading } =
    useEquipoPlantillas(equipoId);
  const addPlantilla = useAddEquipoPlantilla(equipoId);
  const removePlantilla = useRemoveEquipoPlantilla(equipoId);

  const [plantillaId, setPlantillaId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!plantillaId) {
      toast.error("Selecciona una plantilla");
      return;
    }
    addPlantilla.mutate(plantillaId, {
      onSuccess: () => {
        toast.success("Plantilla asociada");
        setPlantillaId(null);
      },
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : "No se pudo asociar la plantilla",
        ),
    });
  };

  const handleRemove = (id: string, nombre: string) => {
    setRemovingId(id);
    removePlantilla.mutate(id, {
      onSuccess: () => toast.success(`Plantilla ${nombre} desasociada`),
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : "No se pudo quitar la plantilla",
        ),
      onSettled: () => setRemovingId(null),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Asociar plantilla</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] text-muted-foreground uppercase">
                Plantilla
              </label>
              <PlantillaSelect
                allowClear={false}
                excludeIds={asociadas.map((a) => a.plantilla.id)}
                onChange={setPlantillaId}
                value={plantillaId}
              />
            </div>
            <Button loading={addPlantilla.isPending} onClick={handleAdd}>
              <Plus />
              Asociar
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Plantillas aplicables</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="space-y-2.5 p-5">
              {Array.from({ length: 3 }).map((_, idx) => (
                <Skeleton className="h-12 w-full" key={idx} />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="No se pudieron cargar las plantillas asociadas."
                title="Error al cargar"
              />
            </div>
          )}

          {!isLoading && !error && asociadas.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="Asocia plantillas de mantenimiento aplicables a este equipo."
                title="Sin plantillas asociadas"
              />
            </div>
          )}

          {!isLoading && !error && asociadas.length > 0 && (
            <div className="divide-y divide-border/60">
              {asociadas.map((a) => (
                <div
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent/40"
                  key={a.id}
                >
                  <div className="min-w-0">
                    <Link
                      className="font-medium hover:underline"
                      href={`/plantillas/${a.plantilla.id}`}
                    >
                      {a.plantilla.nombre}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
                      <Badge variant="secondary">
                        {a.plantilla.itemsCount} ítem
                        {a.plantilla.itemsCount === 1 ? "" : "s"}
                      </Badge>
                      {a.plantilla.tipoEquipo && <span>{a.plantilla.tipoEquipo}</span>}
                      {a.plantilla.frecuencia && <span>· {a.plantilla.frecuencia}</span>}
                      {a.plantilla.activo === false && (
                        <Badge variant="outline">Inactiva</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {canManage && a.plantilla.activo !== false && (
                      <Button
                        render={
                          <Link
                            href={`/mantenciones?equipo=${equipoId}&plantilla=${a.plantilla.id}`}
                          />
                        }
                        size="sm"
                        variant="outline"
                      >
                        <CalendarPlus />
                        Programar
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        aria-label={`Quitar plantilla ${a.plantilla.nombre}`}
                        loading={
                          removePlantilla.isPending &&
                          removingId === a.plantilla.id
                        }
                        onClick={() =>
                          handleRemove(a.plantilla.id, a.plantilla.nombre)
                        }
                        size="sm"
                        variant="destructive-outline"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
