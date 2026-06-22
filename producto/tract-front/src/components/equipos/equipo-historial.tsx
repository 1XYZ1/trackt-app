"use client";

import Link from "next/link";
import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasRole } from "@/contexts/auth-context";
import { useEquipoHistorial } from "@/hooks/use-equipos";
import type { EquipoHistorial } from "@/lib/api/equipos";
import { descargarHistorialEquipoCsv } from "@/lib/api/reportes";

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Seccion({
  children,
  count,
  title,
}: {
  children: React.ReactNode;
  count: number;
  title: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {title}
          <Badge variant="secondary">{count}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="text-muted-foreground text-xs">Sin registros.</p>
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-auto pr-1">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Fila({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/60 p-2 text-sm transition-colors hover:bg-accent/40">
      {children}
    </div>
  );
}

export type EquipoHistorialProps = {
  equipoId: string;
};

export function EquipoHistorial({ equipoId }: EquipoHistorialProps) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [downloading, setDownloading] = useState(false);
  const isAdmin = useHasRole("admin");
  const isJefe = useHasRole("jefe_taller");
  const canExport = isAdmin || isJefe;

  const { data, error, isLoading } = useEquipoHistorial(equipoId, {
    desde: desde || undefined,
    hasta: hasta || undefined,
  });

  const handleCsv = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      await descargarHistorialEquipoCsv(equipoId, data.equipo.codigo, {
        desde: desde || undefined,
        hasta: hasta || undefined,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo descargar el historial",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground uppercase" htmlFor="hist-desde">
              Desde
            </label>
            <DatePicker
              className="w-44"
              id="hist-desde"
              max={hasta || undefined}
              onChange={setDesde}
              placeholder="Desde"
              value={desde}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground uppercase" htmlFor="hist-hasta">
              Hasta
            </label>
            <DatePicker
              className="w-44"
              id="hist-hasta"
              min={desde || undefined}
              onChange={setHasta}
              placeholder="Hasta"
              value={hasta}
            />
          </div>
          {(desde || hasta) && (
            <Button
              onClick={() => {
                setDesde("");
                setHasta("");
              }}
              size="sm"
              variant="ghost"
            >
              Limpiar
            </Button>
          )}
          {canExport && (
            <Button
              className="ml-auto"
              disabled={!data}
              loading={downloading}
              onClick={handleCsv}
              size="sm"
              variant="outline"
            >
              <FileDown />
              Historial CSV
            </Button>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton className="h-44 rounded-2xl" key={idx} />
          ))}
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="p-5">
            <EmptyState
              icon="wrench"
              message="No se pudo cargar el historial del equipo."
              title="Historial no disponible"
            />
          </CardContent>
        </Card>
      )}

      {data && (
        <HistorialContenido historial={data} />
      )}
    </div>
  );
}

function HistorialContenido({ historial }: { historial: EquipoHistorial }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Seccion count={historial.repuestosConsumidos.length} title="Repuestos consumidos">
        {historial.repuestosConsumidos.map((r) => (
          <Fila key={r.repuestoId}>
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium">{r.nombre ?? r.codigo}</span>
              <span className="text-muted-foreground text-xs">
                {r.cantidadConsumida} {r.unidad ?? ""} · {r.movimientos} mov.
              </span>
            </span>
          </Fila>
        ))}
      </Seccion>

      <Seccion count={historial.ordenes.length} title="Órdenes de trabajo">
        {historial.ordenes.map((o) => (
          <Link className="block" href={`/ordenes/${o.id}`} key={o.id}>
            <Fila>
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{o.codigo}</span>
                <Badge variant="secondary">{o.estado}</Badge>
              </span>
              <span className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
                {o.descripcion} · {fmt(o.createdAt)}
              </span>
            </Fila>
          </Link>
        ))}
      </Seccion>

      <Seccion count={historial.tickets.length} title="Tickets">
        {historial.tickets.map((t) => (
          <Link className="block" href={`/tickets/${t.id}`} key={t.id}>
            <Fila>
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{t.codigo}</span>
                <Badge variant="secondary">{t.estado}</Badge>
              </span>
              <span className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
                {t.titulo} · {fmt(t.createdAt)}
              </span>
            </Fila>
          </Link>
        ))}
      </Seccion>

      <Seccion count={historial.movimientos.length} title="Movimientos de inventario">
        {historial.movimientos.map((m) => (
          <Fila key={m.id}>
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium text-xs">{m.repuesto.codigo}</span>
              <Badge variant="secondary">{m.tipo}</Badge>
            </span>
            <span className="mt-0.5 block text-muted-foreground text-xs">
              {m.cantidad} {m.repuesto.unidad} · stock {m.stockResultante} ·{" "}
              {fmt(m.createdAt)}
            </span>
          </Fila>
        ))}
      </Seccion>

      <Seccion count={historial.reservas.length} title="Reservas">
        {historial.reservas.map((r) => (
          <Fila key={r.id}>
            <span className="flex items-center justify-between gap-2">
              <span className="text-xs">
                {r.ticket ? `Ticket ${r.ticket.codigo}` : "Reserva"}
              </span>
              <Badge variant="secondary">{r.estado}</Badge>
            </span>
            <span className="mt-0.5 block text-muted-foreground text-xs">
              {r.items.length} ítem{r.items.length === 1 ? "" : "s"} ·{" "}
              {fmt(r.createdAt)}
            </span>
          </Fila>
        ))}
      </Seccion>

      <Seccion count={historial.programaciones.length} title="Programaciones">
        {historial.programaciones.map((p) => (
          <Fila key={p.id}>
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium text-xs">{p.titulo}</span>
              <Badge variant="secondary">{p.estado}</Badge>
            </span>
            <span className="mt-0.5 block text-muted-foreground text-xs">
              {fmt(p.fechaProgramada)}
              {p.plantilla ? ` · ${p.plantilla.nombre}` : ""}
            </span>
          </Fila>
        ))}
      </Seccion>

      <Seccion count={historial.evidencias.length} title="Evidencias">
        {historial.evidencias.map((e) => (
          <Fila key={e.id}>
            <span className="flex items-center justify-between gap-2">
              <span className="text-xs">
                {e.ticket ? `Ticket ${e.ticket.codigo}` : "Evidencia"}
              </span>
              <span className="text-muted-foreground text-xs">
                {fmt(e.createdAt)}
              </span>
            </span>
            {e.descripcion && (
              <span className="mt-0.5 line-clamp-1 block text-muted-foreground text-xs">
                {e.descripcion}
              </span>
            )}
          </Fila>
        ))}
      </Seccion>
    </div>
  );
}
