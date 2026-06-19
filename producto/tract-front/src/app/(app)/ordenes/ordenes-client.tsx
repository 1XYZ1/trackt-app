"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Layers, Plus, PlayCircle } from "lucide-react";
import {
  EmptyState,
  ListSkeleton,
  OtCard,
  type OtResumen,
} from "@/components/core";
import { EquipoSelect } from "@/components/equipos";
import { NuevaOrdenSheet } from "@/components/ordenes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrdenes, usePrefetchOrden } from "@/hooks/use-ordenes";
import type { OrdenEstado, OrdenTrabajo } from "@/lib/api/ordenes";
import { cn } from "@/lib/utils";

// Estados reales de una OT (el backend solo emite estos cuatro). Se omiten
// ASIGNADO/EJECUTADO porque pertenecen a tickets, no a OT: como filtro darian
// siempre 0 resultados.
const estados: ("TODOS" | OrdenEstado)[] = [
  "TODOS",
  "PENDIENTE",
  "EN_EJECUCION",
  "CERRADO",
  "CANCELADO",
];

function estadoLabel(estado: "TODOS" | OrdenEstado) {
  if (estado === "TODOS") return "Todos";
  if (estado === "EN_EJECUCION") return "En ejecución";
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
  const { data: ordenes = [], error, isLoading } = useOrdenes();
  const prefetchOrden = usePrefetchOrden();

  const filteredOrdenes = useMemo(() => {
    // TODO(api): mover filtros a backend cuando GET /ordenes soporte query params.
    return ordenes.filter((orden) => {
      if (estado !== "TODOS" && orden.estado !== estado) return false;
      if (
        equipoId &&
        orden.equipoId !== equipoId &&
        orden.equipo?.id !== equipoId
      ) {
        return false;
      }
      return true;
    });
  }, [equipoId, estado, ordenes]);

  const summary = getSummary(ordenes);
  const hasActiveFilters = estado !== "TODOS" || Boolean(equipoId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
            <ClipboardList className="size-3.5" />
            Flujo principal de mantenimiento
          </div>
          <h1 className="font-semibold text-2xl tracking-tight">
            Órdenes de Trabajo
          </h1>
          <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
            Gestión de órdenes de mantenimiento asociadas a equipos
            operacionales.
          </p>
        </div>
        <Button className="shrink-0" onClick={() => setCreateOpen(true)} size="sm">
          <Plus />
          Nueva OT
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={<Layers className="size-4" />}
          label="Total OT"
          tone="muted"
          value={summary.total}
        />
        <SummaryCard
          icon={<PlayCircle className="size-4" />}
          label="Abiertas"
          tone="brand"
          value={summary.abiertas}
        />
        <SummaryCard
          icon={<CheckCircle2 className="size-4" />}
          label="Cerradas"
          tone="success"
          value={summary.cerradas}
        />
      </div>

      <Card>
        <CardHeader className="gap-3 pb-3">
          <div>
            <CardTitle className="text-base">Listado de OT</CardTitle>
            <p className="text-muted-foreground text-xs">
              {filteredOrdenes.length} resultado
              {filteredOrdenes.length === 1 ? "" : "s"}
              {hasActiveFilters ? " según filtros." : "."}
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_minmax(0,18rem)]">
            <div
              aria-label="Filtrar por estado"
              className="flex flex-wrap gap-1.5"
              role="group"
            >
              {estados.map((item) => {
                const active = estado === item;
                return (
                  <button
                    aria-pressed={active}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                      active
                        ? "bg-brand-primary text-brand-primary-foreground shadow-glow-sm"
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
              message="No se pudieron cargar las órdenes de trabajo desde la API."
              title="Error al cargar órdenes"
            />
          )}

          {!isLoading && !error && ordenes.length === 0 && (
            <div className="space-y-4">
              <EmptyState
                icon="clipboard"
                message="Crea una OT para iniciar el flujo de mantenimiento sobre un equipo operacional."
                title="No hay órdenes de trabajo"
              />
              <div className="flex justify-center">
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus />
                  Crear primera OT
                </Button>
              </div>
            </div>
          )}

          {!isLoading &&
            !error &&
            ordenes.length > 0 &&
            filteredOrdenes.length === 0 && (
              <EmptyState
                icon="search"
                message="Ajusta el estado o equipo seleccionado para ver otras órdenes."
                title="Sin resultados"
              />
            )}

          {!isLoading && !error && filteredOrdenes.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredOrdenes.map((orden) => (
                <Link
                  className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  href={`/ordenes/${orden.id}`}
                  key={orden.id}
                  onFocus={() => prefetchOrden(orden.id)}
                  onMouseEnter={() => prefetchOrden(orden.id)}
                >
                  <OtCard
                    className="h-full transition-colors hover:border-brand-primary/40"
                    ot={toOtResumen(orden)}
                  />
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

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "brand" | "success" | "muted";
}) {
  const toneClass =
    tone === "brand"
      ? "bg-brand-primary/10 text-brand-primary ring-brand-primary/20"
      : tone === "success"
        ? "bg-success/10 text-success-foreground ring-success/20"
        : "bg-muted text-muted-foreground ring-border";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${toneClass}`}
        >
          {icon}
        </span>
        <div>
          <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p className="font-mono font-semibold text-2xl tabular-nums leading-tight">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
