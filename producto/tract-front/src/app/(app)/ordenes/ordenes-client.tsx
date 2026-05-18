"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardList, Plus, SlidersHorizontal } from "lucide-react";
import {
  EmptyState,
  ListSkeleton,
  OtCard,
  type OtResumen,
} from "@/components/core";
import { EquipoSelect } from "@/components/equipos";
import { NuevaOrdenSheet } from "@/components/ordenes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrdenes } from "@/hooks/use-ordenes";
import type { OrdenEstado, OrdenTrabajo } from "@/lib/api/ordenes";
import { cn } from "@/lib/utils";

const estados: ("TODOS" | OrdenEstado)[] = [
  "TODOS",
  "PENDIENTE",
  "ASIGNADO",
  "EN_EJECUCION",
  "EJECUTADO",
  "CERRADO",
  "CANCELADO",
];

function estadoLabel(estado: "TODOS" | OrdenEstado) {
  if (estado === "TODOS") return "Todos";
  if (estado === "EN_EJECUCION") return "En ejecucion";
  return estado.charAt(0) + estado.slice(1).toLowerCase();
}

function toOtResumen(orden: OrdenTrabajo): OtResumen {
  return {
    codigo: orden.codigo,
    descripcion: orden.descripcion,
    equipo: orden.equipo
      ? `${orden.equipo.codigo} - ${orden.equipo.nombre}`
      : orden.equipoId,
    estado: orden.estado,
    ticketsCount: orden.tickets?.length ?? 0,
  };
}

function getSummary(ordenes: OrdenTrabajo[]) {
  return {
    abiertas: ordenes.filter((orden) =>
      ["PENDIENTE", "ASIGNADO", "EN_EJECUCION"].includes(orden.estado),
    ).length,
    cerradas: ordenes.filter((orden) => orden.estado === "CERRADO").length,
    total: ordenes.length,
  };
}

export function OrdenesClient() {
  const [estado, setEstado] = useState<"TODOS" | OrdenEstado>("TODOS");
  const [equipoId, setEquipoId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { data: ordenes = [], error, isLoading } = useOrdenes({
    equipoId,
    estado,
  });

  const filteredOrdenes = useMemo(() => {
    // TODO(api): mover filtros a backend cuando GET /ordenes soporte query params.
    return ordenes.filter((orden) => {
      if (estado !== "TODOS" && orden.estado !== estado) return false;
      if (equipoId && orden.equipoId !== equipoId && orden.equipo?.id !== equipoId) {
        return false;
      }
      return true;
    });
  }, [equipoId, estado, ordenes]);

  const summary = getSummary(ordenes);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
            <ClipboardList className="size-3.5" />
            Flujo principal de mantenimiento
          </div>
          <h1 className="font-semibold text-2xl tracking-tight">
            Ordenes de Trabajo
          </h1>
          <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
            Gestion de ordenes de mantenimiento asociadas a equipos
            operacionales.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus />
          Nueva OT
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-lg border-border/70">
          <CardContent className="p-4">
            <p className="font-medium text-[11px] text-muted-foreground uppercase">
              Total OT
            </p>
            <p className="mt-2 font-mono font-semibold text-2xl">
              {summary.total}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-border/70">
          <CardContent className="p-4">
            <p className="font-medium text-[11px] text-muted-foreground uppercase">
              Abiertas
            </p>
            <p className="mt-2 font-mono font-semibold text-2xl text-brand-primary">
              {summary.abiertas}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-border/70">
          <CardContent className="p-4">
            <p className="font-medium text-[11px] text-muted-foreground uppercase">
              Cerradas
            </p>
            <p className="mt-2 font-mono font-semibold text-2xl text-success">
              {summary.cerradas}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="gap-4 pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base">Listado de OT</CardTitle>
              <p className="text-muted-foreground text-xs">
                {filteredOrdenes.length} resultado
                {filteredOrdenes.length === 1 ? "" : "s"} segun filtros.
              </p>
            </div>
            <Badge className="w-fit" variant="outline">
              <SlidersHorizontal />
              Filtros frontend temporales
            </Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <div className="flex flex-wrap gap-1.5">
              {estados.map((item) => {
                const active = estado === item;

                return (
                  <button
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium text-xs transition-colors",
                      active
                        ? "bg-brand-primary text-brand-primary-foreground"
                        : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                    key={item}
                    onClick={() => setEstado(item)}
                    type="button"
                  >
                    {estadoLabel(item)}
                  </button>
                );
              })}
            </div>
            <EquipoSelect
              onChange={setEquipoId}
              placeholder="Filtrar por equipo"
              value={equipoId}
            />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading && <ListSkeleton count={4} columns={2} />}

          {!isLoading && error && (
            <EmptyState
              icon="clipboard"
              message="No se pudieron cargar las ordenes de trabajo desde la API."
              title="Error al cargar ordenes"
            />
          )}

          {!isLoading && !error && ordenes.length === 0 && (
            <div className="space-y-4">
              <EmptyState
                icon="clipboard"
                message="Crea una OT para iniciar el flujo de mantenimiento sobre un equipo operacional."
                title="No hay ordenes de trabajo"
              />
              <div className="flex justify-center">
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus />
                  Crear primera OT
                </Button>
              </div>
            </div>
          )}

          {!isLoading && !error && ordenes.length > 0 && filteredOrdenes.length === 0 && (
            <EmptyState
              icon="search"
              message="Ajusta el estado o equipo seleccionado para ver otras ordenes."
              title="Sin resultados"
            />
          )}

          {!isLoading && !error && filteredOrdenes.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredOrdenes.map((orden) => (
                <Link href={`/ordenes/${orden.id}`} key={orden.id}>
                  <OtCard className="h-full transition-colors hover:border-brand-primary/40" ot={toOtResumen(orden)} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NuevaOrdenSheet onOpenChange={setCreateOpen} open={createOpen} />
    </div>
  );
}
