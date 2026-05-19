"use client";

import { Gauge, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/core";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCargaMecanicos } from "@/hooks/use-tickets";

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

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-lg border-border/70">
          <CardContent className="p-4">
            <p className="font-medium text-[11px] text-muted-foreground uppercase">
              Total abiertos
            </p>
            <p className="mt-2 font-mono font-semibold text-2xl">
              {totales.totalAbiertos}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-border/70">
          <CardContent className="p-4">
            <p className="font-medium text-[11px] text-muted-foreground uppercase">
              Asignados
            </p>
            <p className="mt-2 font-mono font-semibold text-2xl text-brand-primary">
              {totales.asignados}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-border/70">
          <CardContent className="p-4">
            <p className="font-medium text-[11px] text-muted-foreground uppercase">
              En ejecución
            </p>
            <p className="mt-2 font-mono font-semibold text-2xl">
              {totales.enEjecucion}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-border/70">
          <CardContent className="p-4">
            <p className="font-medium text-[11px] text-muted-foreground uppercase">
              Ejecutados (pendientes de validar)
            </p>
            <p className="mt-2 font-mono font-semibold text-2xl text-success">
              {totales.ejecutados}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Carga por mecánico</CardTitle>
          <p className="text-muted-foreground text-xs">
            Ordenado por mayor carga total. Excluye tickets cerrados y cancelados.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center gap-2 px-5 py-16 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando datos del taller...
            </div>
          )}

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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3 font-semibold">Mecánico</th>
                    <th className="px-5 py-3 font-semibold">Email</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Pendientes
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Asignados
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      En ejecución
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Ejecutados
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Total abiertos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((row) => (
                    <tr
                      className="border-border/60 border-b transition-colors last:border-0 hover:bg-secondary/25"
                      key={row.mecanicoId}
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 font-medium">
                        {row.nombre ?? row.email ?? row.mecanicoId}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground text-xs">
                        {row.email ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs">
                        {row.pendientes}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs">
                        {row.asignados}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs">
                        {row.enEjecucion}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs">
                        {row.ejecutados}
                      </td>
                      <td className="px-5 py-3.5 text-right">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
