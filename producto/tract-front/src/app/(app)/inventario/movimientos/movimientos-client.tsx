"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/core";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMovimientos, useRepuestos } from "@/hooks/use-inventario";
import type {
  MovimientosFilters,
  MovimientoTipo,
} from "@/lib/api/inventario";

const TIPOS: MovimientoTipo[] = [
  "ENTRADA",
  "SALIDA",
  "AJUSTE",
  "RESERVA",
  "LIBERACION",
  "CONSUMO",
];

function tipoBadgeVariant(
  tipo: MovimientoTipo,
): "default" | "secondary" | "outline" | "error" | "warning" {
  switch (tipo) {
    case "ENTRADA":
      return "default";
    case "CONSUMO":
    case "SALIDA":
      return "secondary";
    case "AJUSTE":
      return "warning";
    case "RESERVA":
      return "outline";
    case "LIBERACION":
      return "outline";
    default:
      return "secondary";
  }
}

export function MovimientosClient() {
  const [repuestoId, setRepuestoId] = useState("");
  const [tipo, setTipo] = useState<MovimientoTipo | "">("");
  const [ticketId, setTicketId] = useState("");
  const [reservaId, setReservaId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  // Debounce 300ms en los text inputs para no martillar el endpoint.
  const [debouncedTicket, setDebouncedTicket] = useState("");
  const [debouncedReserva, setDebouncedReserva] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTicket(ticketId.trim()), 300);
    return () => clearTimeout(t);
  }, [ticketId]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedReserva(reservaId.trim()), 300);
    return () => clearTimeout(t);
  }, [reservaId]);

  const filters: MovimientosFilters = {
    repuestoId: repuestoId || undefined,
    ticketId: debouncedTicket || undefined,
    reservaId: debouncedReserva || undefined,
    tipo: tipo || undefined,
    desde: desde || undefined,
    hasta: hasta || undefined,
  };

  const { data: movimientos = [], error, isLoading } = useMovimientos(filters);
  const repuestos = useRepuestos();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
          <History className="size-3.5" />
          Trazabilidad de inventario
        </div>
        <h1 className="font-semibold text-2xl tracking-tight">
          Movimientos
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
          Historial inmutable de cada cambio de stock: entradas, ajustes,
          reservas, liberaciones y consumos.
        </p>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1">
              <label className="font-medium text-xs text-muted-foreground">
                Repuesto
              </label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                onChange={(e) => setRepuestoId(e.target.value)}
                value={repuestoId}
              >
                <option value="">Todos</option>
                {(repuestos.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.codigo} - {r.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-xs text-muted-foreground">
                Tipo
              </label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                onChange={(e) => setTipo(e.target.value as MovimientoTipo | "")}
                value={tipo}
              >
                <option value="">Todos</option>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-xs text-muted-foreground">
                Ticket ID
              </label>
              <Input
                onChange={(e) => setTicketId(e.target.value)}
                placeholder="tk-..."
                value={ticketId}
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-xs text-muted-foreground">
                Reserva ID
              </label>
              <Input
                onChange={(e) => setReservaId(e.target.value)}
                placeholder="res-..."
                value={reservaId}
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-xs text-muted-foreground">
                Desde
              </label>
              <Input
                onChange={(e) => setDesde(e.target.value)}
                type="date"
                value={desde}
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-xs text-muted-foreground">
                Hasta
              </label>
              <Input
                onChange={(e) => setHasta(e.target.value)}
                type="date"
                value={hasta}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Historial</CardTitle>
          <p className="text-muted-foreground text-xs">
            {movimientos.length} movimiento
            {movimientos.length === 1 ? "" : "s"} (ultimos 100).
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center gap-2 px-5 py-12 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando movimientos...
            </div>
          )}

          {!isLoading && error && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="No se pudieron cargar los movimientos."
                title="Error al cargar"
              />
            </div>
          )}

          {!isLoading && !error && movimientos.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon="search"
                message="Ajusta los filtros o registra movimientos de stock."
                title="Sin movimientos"
              />
            </div>
          )}

          {!isLoading && !error && movimientos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3 font-semibold">Fecha</th>
                    <th className="px-5 py-3 font-semibold">Repuesto</th>
                    <th className="px-5 py-3 font-semibold">Tipo</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Cantidad
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Stock resultante
                    </th>
                    <th className="px-5 py-3 font-semibold">Ticket</th>
                    <th className="px-5 py-3 font-semibold">Reserva</th>
                    <th className="px-5 py-3 font-semibold">Observacion</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => (
                    <tr
                      className="border-border/60 border-b last:border-0 hover:bg-secondary/25"
                      key={m.id}
                    >
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground text-xs">
                        {new Date(m.createdAt).toLocaleString("es-CL")}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {m.repuesto ? (
                          <Link
                            className="font-mono font-semibold text-xs hover:underline"
                            href={`/inventario/repuestos/${m.repuestoId}`}
                          >
                            {m.repuesto.codigo}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">
                            {m.repuestoId}
                          </span>
                        )}
                        {m.repuesto && (
                          <div className="text-muted-foreground text-[11px]">
                            {m.repuesto.nombre}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <Badge variant={tipoBadgeVariant(m.tipo)}>
                          {m.tipo}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs">
                        {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs">
                        {m.stockResultante}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-[11px] text-muted-foreground">
                        {m.ticketId ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-[11px] text-muted-foreground">
                        {m.reservaId ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">
                        {m.observacion ?? "—"}
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
