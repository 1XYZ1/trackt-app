"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/core";
import {
  DesactivarPlantillaDialog,
  PlantillaFormSheet,
} from "@/components/plantillas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useHasRole } from "@/contexts/auth-context";
import { usePlantillas, useReactivarPlantilla } from "@/hooks/use-plantillas";
import type { PlantillaListItem } from "@/lib/api/plantillas";

export function PlantillasClient() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlantillaListItem | null>(null);
  const [toDeactivate, setToDeactivate] = useState<PlantillaListItem | null>(
    null,
  );
  const [reactivarId, setReactivarId] = useState<string | null>(null);

  const isAdmin = useHasRole("admin");
  const isJefe = useHasRole("jefe_taller");
  const canManage = isAdmin || isJefe;
  const reactivar = useReactivarPlantilla();

  useEffect(() => {
    const trimmed = query.trim();
    const t = setTimeout(() => setDebouncedQuery(trimmed), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: plantillas = [], error, isLoading } = usePlantillas({
    includeInactive,
    search: debouncedQuery || undefined,
  });

  const handleReactivar = (plantilla: PlantillaListItem) => {
    setReactivarId(plantilla.id);
    reactivar.mutate(plantilla.id, {
      onSuccess: () => toast.success(`Plantilla ${plantilla.nombre} reactivada`),
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : "No se pudo reactivar",
        ),
      onSettled: () => setReactivarId(null),
    });
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (plantilla: PlantillaListItem) => {
    setEditing(plantilla);
    setFormOpen(true);
  };
  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditing(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
            <ClipboardList className="size-3.5" />
            Mantenimiento
          </div>
          <h1 className="font-semibold text-2xl tracking-tight">Plantillas</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
            Recetas de mantenimiento con insumos y checklist reutilizables.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-7"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar plantilla"
              type="search"
              value={query}
            />
          </div>
          {canManage && (
            <Button onClick={openCreate} size="sm">
              <Plus />
              Nueva plantilla
            </Button>
          )}
        </div>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Plantillas registradas</CardTitle>
            <p className="text-muted-foreground text-xs">
              {plantillas.length} resultado{plantillas.length === 1 ? "" : "s"}.
            </p>
          </div>
          {canManage && (
            <label className="flex items-center gap-2 text-muted-foreground text-xs">
              <input
                checked={includeInactive}
                className="size-3.5"
                onChange={(event) => setIncludeInactive(event.target.checked)}
                type="checkbox"
              />
              Incluir inactivas
            </label>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center gap-2 px-5 py-16 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando plantillas...
            </div>
          )}

          {!isLoading && error && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="No se pudieron cargar las plantillas desde la API."
                title="Error al cargar plantillas"
              />
            </div>
          )}

          {!isLoading && !error && plantillas.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="Crea la primera plantilla de mantenimiento."
                title="No hay plantillas"
              />
            </div>
          )}

          {!isLoading && !error && plantillas.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3 font-semibold">Nombre</th>
                    <th className="px-5 py-3 font-semibold">Tipo equipo</th>
                    <th className="px-5 py-3 font-semibold">Frecuencia</th>
                    <th className="px-5 py-3 text-right font-semibold">Ítems</th>
                    {includeInactive && (
                      <th className="px-5 py-3 font-semibold">Estado</th>
                    )}
                    {canManage && <th className="px-5 py-3 text-right font-semibold">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {plantillas.map((plantilla) => {
                    const inactive = plantilla.activo === false;
                    return (
                      <tr
                        className="border-border/60 border-b transition-colors last:border-0 hover:bg-secondary/25"
                        key={plantilla.id}
                      >
                        <td className="px-5 py-3.5 font-medium">
                          <Link
                            className="hover:underline"
                            href={`/plantillas/${plantilla.id}`}
                          >
                            {plantilla.nombre}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground text-xs">
                          {plantilla.tipoEquipo ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground text-xs">
                          {plantilla.frecuencia ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">
                          {plantilla.itemsCount}
                        </td>
                        {includeInactive && (
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <Badge variant={inactive ? "outline" : "default"}>
                              {inactive ? "Inactiva" : "Activa"}
                            </Badge>
                          </td>
                        )}
                        {canManage && (
                          <td className="whitespace-nowrap px-5 py-3.5 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                onClick={() => openEdit(plantilla)}
                                size="sm"
                                variant="ghost"
                              >
                                <Pencil />
                                Editar
                              </Button>
                              {inactive ? (
                                <Button
                                  loading={
                                    reactivar.isPending &&
                                    reactivarId === plantilla.id
                                  }
                                  onClick={() => handleReactivar(plantilla)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Power />
                                  Reactivar
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => setToDeactivate(plantilla)}
                                  size="sm"
                                  variant="destructive-outline"
                                >
                                  <PowerOff />
                                  Desactivar
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <>
          <PlantillaFormSheet
            onOpenChange={handleFormOpenChange}
            open={formOpen}
            plantilla={editing}
          />
          <DesactivarPlantillaDialog
            onOpenChange={(open) => {
              if (!open) setToDeactivate(null);
            }}
            open={Boolean(toDeactivate)}
            plantilla={toDeactivate}
          />
        </>
      )}
    </div>
  );
}
