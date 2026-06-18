"use client";

import {
  CheckCircle2,
  CircleDashed,
  Gauge,
  Layers,
  PlayCircle,
} from "lucide-react";
import { EmptyState, UserAvatar } from "@/components/core";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCargaMecanicos } from "@/hooks/use-tickets";
import type { CargaMecanico } from "@/lib/api/tickets";
import { ESTADO_DOT } from "@/lib/tickets/format";
import { cn } from "@/lib/utils";

type KpiTone = "default" | "primary" | "success";

const KPI_TONE: Record<KpiTone, string> = {
  default: "text-foreground",
  primary: "text-brand-primary",
  success: "text-success",
};

function KpiCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Gauge;
  label: string;
  value: number;
  tone?: KpiTone;
}) {
  return (
    <Card className="rounded-lg border-border/70">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p className={cn("mt-2 font-mono font-semibold text-2xl", KPI_TONE[tone])}>
            {value}
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

/** Barra apilada de distribución de carga, con tokens de estado. */
function CargaBar({ row }: { row: CargaMecanico }) {
  const total = row.totalAbiertos || 1;
  const segments = [
    { key: "PENDIENTE" as const, value: row.pendientes },
    { key: "ASIGNADO" as const, value: row.asignados },
    { key: "EN_EJECUCION" as const, value: row.enEjecucion },
    { key: "EJECUTADO" as const, value: row.ejecutados },
  ].filter((s) => s.value > 0);

  if (row.totalAbiertos === 0) {
    return <div className="h-1.5 w-full rounded-full bg-input" />;
  }

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-input">
      {segments.map((segment) => (
        <span
          className={cn(ESTADO_DOT[segment.key])}
          key={segment.key}
          style={{ width: `${(segment.value / total) * 100}%` }}
          title={`${segment.value}`}
        />
      ))}
    </div>
  );
}

function CargaSkeleton() {
  return (
    <div className="space-y-px p-2">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div className="flex items-center gap-3 px-3 py-3" key={idx}>
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <Skeleton className="h-6 w-10 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function CargaMecanicosClient() {
  const { data: rows = [], error, isLoading } = useCargaMecanicos();

  // Resumen agregado del taller (suma de todos los buckets).
  const totales = rows.reduce(
    (acc, r) => ({
      pendientes: acc.pendientes + r.pendientes,
      asignados: acc.asignados + r.asignados,
      enEjecucion: acc.enEjecucion + r.enEjecucion,
      ejecutados: acc.ejecutados + r.ejecutados,
      totalAbiertos: acc.totalAbiertos + r.totalAbiertos,
    }),
    { pendientes: 0, asignados: 0, enEjecucion: 0, ejecutados: 0, totalAbiertos: 0 },
  );

  const ordered = [...rows].sort((a, b) => b.totalAbiertos - a.totalAbiertos);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
          <Gauge className="size-3.5" />
          Gestión de taller
        </div>
        <h1 className="font-semibold text-2xl tracking-tight">
          Carga de mecánicos
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
          Resumen operativo de tickets abiertos por mecánico. Ayuda a detectar
          sobrecarga y decidir reasignaciones.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Layers} label="Total abiertos" value={totales.totalAbiertos} />
        <KpiCard
          icon={CircleDashed}
          label="Asignados"
          tone="primary"
          value={totales.asignados}
        />
        <KpiCard
          icon={PlayCircle}
          label="En ejecución"
          value={totales.enEjecucion}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Ejecutados (por validar)"
          tone="success"
          value={totales.ejecutados}
        />
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Carga por mecánico</CardTitle>
          <p className="text-muted-foreground text-xs">
            Ordenado por mayor carga total. Excluye tickets cerrados y cancelados.
          </p>
          {!isLoading && !error && rows.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-muted-foreground text-xs">
              <LegendDot estado="PENDIENTE" label="Pendiente" />
              <LegendDot estado="ASIGNADO" label="Asignado" />
              <LegendDot estado="EN_EJECUCION" label="En ejecución" />
              <LegendDot estado="EJECUTADO" label="Ejecutado" />
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && <CargaSkeleton />}

          {!isLoading && error && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="No se pudo cargar el resumen del taller desde la API."
                title="Error al cargar carga"
              />
            </div>
          )}

          {!isLoading && !error && rows.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="No hay mecánicos registrados en este tenant."
                title="Sin mecánicos"
              />
            </div>
          )}

          {!isLoading && !error && rows.length > 0 && (
            <>
              {/* Mobile/tablet: tarjetas con barra de distribución. */}
              <div className="flex flex-col divide-y divide-border/60 lg:hidden">
                {ordered.map((row) => (
                  <div className="flex flex-col gap-2.5 p-4" key={row.mecanicoId}>
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        className="size-8"
                        user={{ nombre: row.nombre, email: row.email }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">
                          {row.nombre ?? row.email ?? row.mecanicoId}
                        </p>
                        {row.email && (
                          <p className="truncate text-muted-foreground text-xs">
                            {row.email}
                          </p>
                        )}
                      </div>
                      <Badge variant={row.totalAbiertos >= 5 ? "error" : "secondary"}>
                        {row.totalAbiertos}
                      </Badge>
                    </div>
                    <CargaBar row={row} />
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs tabular-nums">
                      <span>Pend. {row.pendientes}</span>
                      <span>Asig. {row.asignados}</span>
                      <span>Ejec. {row.enEjecucion}</span>
                      <span>Term. {row.ejecutados}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: tabla densa con barra de carga relativa. */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                      <th className="px-5 py-3 font-semibold">Mecánico</th>
                      <th className="px-5 py-3 font-semibold">Distribución</th>
                      <th className="px-5 py-3 text-right font-semibold">Pend.</th>
                      <th className="px-5 py-3 text-right font-semibold">Asig.</th>
                      <th className="px-5 py-3 text-right font-semibold">Ejec.</th>
                      <th className="px-5 py-3 text-right font-semibold">Term.</th>
                      <th className="px-5 py-3 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordered.map((row) => (
                      <tr
                        className="border-border/60 border-b transition-colors last:border-0 hover:bg-secondary/25"
                        key={row.mecanicoId}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar
                              className="size-7"
                              user={{ nombre: row.nombre, email: row.email }}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {row.nombre ?? row.email ?? row.mecanicoId}
                              </p>
                              {row.email && (
                                <p className="truncate text-muted-foreground text-xs">
                                  {row.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="w-44 px-5 py-3">
                          <CargaBar row={row} />
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-muted-foreground text-xs">
                          {row.pendientes}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-muted-foreground text-xs">
                          {row.asignados}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-muted-foreground text-xs">
                          {row.enEjecucion}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-muted-foreground text-xs">
                          {row.ejecutados}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Badge
                            variant={row.totalAbiertos >= 5 ? "error" : "secondary"}
                          >
                            {row.totalAbiertos}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LegendDot({
  estado,
  label,
}: {
  estado: keyof typeof ESTADO_DOT;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", ESTADO_DOT[estado])} />
      {label}
    </span>
  );
}
