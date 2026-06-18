"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckSquare, Loader2, Pencil } from "lucide-react";
import { EmptyState } from "@/components/core";
import {
  PlantillaFormSheet,
  PlantillaItemsEditor,
} from "@/components/plantillas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHasRole } from "@/contexts/auth-context";
import { usePlantilla } from "@/hooks/use-plantillas";
import { getChecklist } from "@/lib/api/plantillas";

export type PlantillaDetalleClientProps = {
  id: string;
};

export function PlantillaDetalleClient({ id }: PlantillaDetalleClientProps) {
  const [editOpen, setEditOpen] = useState(false);
  const isAdmin = useHasRole("admin");
  const isJefe = useHasRole("jefe_taller");
  const canManage = isAdmin || isJefe;

  const { data: plantilla, error, isLoading } = usePlantilla(id);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-16 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Cargando plantilla...
      </div>
    );
  }

  if (error || !plantilla) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          className="inline-flex w-fit items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
          href="/plantillas"
        >
          <ArrowLeft className="size-4" />
          Volver a plantillas
        </Link>
        <Card className="rounded-lg border-border/70">
          <CardContent className="p-5">
            <EmptyState
              icon="wrench"
              message="No se pudo cargar la plantilla."
              title="Plantilla no disponible"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const checklist = getChecklist(plantilla.metadata);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          className="inline-flex w-fit items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
          href="/plantillas"
        >
          <ArrowLeft className="size-4" />
          Volver a plantillas
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="font-semibold text-2xl tracking-tight">
              {plantilla.nombre}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
              {plantilla.tipoEquipo && (
                <Badge variant="secondary">{plantilla.tipoEquipo}</Badge>
              )}
              {plantilla.frecuencia && (
                <Badge variant="outline">{plantilla.frecuencia}</Badge>
              )}
              {plantilla.activo === false && (
                <Badge variant="outline">Inactiva</Badge>
              )}
            </div>
            {plantilla.descripcion && (
              <p className="max-w-2xl text-muted-foreground text-sm">
                {plantilla.descripcion}
              </p>
            )}
          </div>
          {canManage && (
            <Button onClick={() => setEditOpen(true)} size="sm" variant="outline">
              <Pencil />
              Editar
            </Button>
          )}
        </div>
      </div>

      <PlantillaItemsEditor
        canManage={canManage}
        items={plantilla.items}
        plantillaId={id}
      />

      <Card className="rounded-lg border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckSquare className="size-4" />
            Checklist ({checklist.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {checklist.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sin pasos de checklist. {canManage ? "Edita la plantilla para agregarlos." : ""}
            </p>
          ) : (
            <ol className="space-y-1.5">
              {checklist.map((paso, idx) => (
                <li className="flex items-start gap-2 text-sm" key={idx}>
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs">
                    {idx + 1}
                  </span>
                  {paso}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <PlantillaFormSheet
          onOpenChange={setEditOpen}
          open={editOpen}
          plantilla={plantilla}
        />
      )}
    </div>
  );
}
