"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, FilterX, History } from "lucide-react";
import { EmptyState } from "@/components/core";
import { MovimientoBadge, MovimientoCantidad } from "@/components/inventario";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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

const TIPO_LABEL: Record<MovimientoTipo, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
  RESERVA: "Reserva",
  LIBERACION: "Liberación",
  CONSUMO: "Consumo",
};

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

  const hasFilters = Boolean(
    repuestoId || ticketId || reservaId || tipo || desde || hasta,
  );

  const clearFilters = () => {
    setRepuestoId("");
    setTipo("");
    setTicketId("");
    setReservaId("");
    setDesde("");
    setHasta("");
  };

  const { data: movimientos = [], error, isLoading } = useMovimientos(filters);
  const repuestos = useRepuestos();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
            <History className="size-3.5" />
            Trazabilidad de inventario
          </div>
          <h1 className="font-semibold text-2xl tracking-tight">Movimientos</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
            Historial inmutable de cada cambio de stock: entradas, ajustes,
            reservas, liberaciones y consumos.
          </p>
        </div>
        <Link href="/inventario">
          <Button size="sm" variant="outline">
            <ArrowLeft />
            Volver a inventario
          </Button>
        </Link>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          {hasFilters && (
            <Button onClick={clearFilters} size="sm" variant="ghost">
              <FilterX />
              Limpiar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1.5">
              <label
                className="font-medium text-muted-foreground text-xs"
                htmlFor="mov-repuesto"
              >
                Repuesto
              </label>
              <Select
                items={[
                  { label: "Todos", value: null },
                  ...(repuestos.data ?? []).map((r) => ({
                    label: `${r.codigo} - ${r.nombre}`,
                    value: r.id,
                  })),
                ]}
                onValueChange={(value) =>
                  setRepuestoId((value as string | null) ?? "")
                }
                value={repuestoId || null}
              >
                <SelectTrigger id="mov-repuesto">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos</SelectItem>
                  {(repuestos.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.codigo} - {r.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label
                className="font-medium text-muted-foreground text-xs"
                htmlFor="mov-tipo"
              >
                Tipo
              </label>
              <Select
                items={[
                  { label: "Todos", value: null },
                  ...TIPOS.map((t) => ({ label: TIPO_LABEL[t], value: t })),
                ]}
                onValueChange={(value) =>
                  setTipo((value as MovimientoTipo | null) ?? "")
                }
                value={tipo || null}
              >
                <SelectTrigger id="mov-tipo">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos</SelectItem>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label
                className="font-medium text-muted-foreground text-xs"
                htmlFor="mov-ticket"
              >
                Ticket ID
              </label>
              <Input
                id="mov-ticket"
                onChange={(e) => setTicketId(e.target.value)}
                placeholder="tk-..."
                value={ticketId}
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="font-medium text-muted-foreground text-xs"
                htmlFor="mov-reserva"
              >
                Reserva ID
              </label>
              <Input
                id="mov-reserva"
                onChange={(e) => setReservaId(e.target.value)}
                placeholder="res-..."
                value={reservaId}
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="font-medium text-muted-foreground text-xs"
                htmlFor="mov-desde"
              >
                Desde
              </label>
              <DatePicker
                id="mov-desde"
                max={hasta || undefined}
                onChange={setDesde}
                placeholder="Desde"
                value={desde}
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="font-medium text-muted-foreground text-xs"
                htmlFor="mov-hasta"
              >
                Hasta
              </label>
              <DatePicker
                id="mov-hasta"
                min={desde || undefined}
                onChange={setHasta}
                placeholder="Hasta"
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
            {movimientos.length === 1 ? "" : "s"} (últimos 100).
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="space-y-px p-5">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div className="flex items-center gap-4 py-2" key={idx}>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="ml-auto h-4 w-16" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="No se pudieron cargar los movimientos. Reintenta en unos segundos."
                title="Error al cargar"
              />
            </div>
          )}

          {!isLoading && !error && movimientos.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon="search"
                message={
                  hasFilters
                    ? "Ningún movimiento coincide con los filtros aplicados."
                    : "Aún no se han registrado movimientos de stock."
                }
                title="Sin movimientos"
              />
            </div>
          )}

          {!isLoading && !error && movimientos.length > 0 && (
            <>
              <div className="hidden overflow-x-auto md:block">
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
                    <th className="px-5 py-3 font-semibold">Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => (
                    <tr
                      className="border-border/60 border-b transition-colors last:border-0 hover:bg-secondary/25"
                      key={m.id}
                    >
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground text-xs tabular-nums">
                        {new Date(m.createdAt).toLocaleString("es-CL")}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {m.repuesto ? (
                          <Link
                            className="rounded-sm font-mono font-semibold text-xs outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            href={`/inventario/repuestos/${m.repuestoId}`}
                          >
                            {m.repuesto.codigo}
                          </Link>
                        ) : (
                          <span className="font-mono text-muted-foreground text-xs">
                            {m.repuestoId}
                          </span>
                        )}
                        {m.repuesto && (
                          <div className="text-[11px] text-muted-foreground">
                            {m.repuesto.nombre}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <MovimientoBadge tipo={m.tipo} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <MovimientoCantidad cantidad={m.cantidad} />
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">
                        {m.stockResultante}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-[11px] text-muted-foreground">
                        {m.ticketId ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-[11px] text-muted-foreground">
                        {m.reservaId ?? "—"}
                      </td>
                      <td className="max-w-xs px-5 py-3 text-muted-foreground text-xs">
                        {m.observacion ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="divide-y divide-border/60 md:hidden">
                {movimientos.map((m) => (
                  <div className="p-4" key={m.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {m.repuesto ? (
                          <Link
                            className="rounded-sm font-mono font-semibold text-xs outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                            href={`/inventario/repuestos/${m.repuestoId}`}
                          >
                            {m.repuesto.codigo}
                          </Link>
                        ) : (
                          <span className="font-mono text-muted-foreground text-xs">
                            {m.repuestoId}
                          </span>
                        )}
                        {m.repuesto && (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {m.repuesto.nombre}
                          </p>
                        )}
                      </div>
                      <MovimientoBadge tipo={m.tipo} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
                      <MovimientoCantidad cantidad={m.cantidad} />
                      <span className="tabular-nums">
                        Stock {m.stockResultante}
                      </span>
                      <span className="tabular-nums">
                        {new Date(m.createdAt).toLocaleDateString("es-CL")}
                      </span>
                    </div>
                    {m.observacion && (
                      <p className="mt-1.5 text-muted-foreground text-xs">
                        {m.observacion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
