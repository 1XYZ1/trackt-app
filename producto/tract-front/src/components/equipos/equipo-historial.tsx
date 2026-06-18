"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { EmptyState } from "@/components/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEquipoHistorial } from "@/hooks/use-equipos";
import type { EquipoHistorial } from "@/lib/api/equipos";

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
    <Card className="rounded-lg border-border/70">
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
          <div className="max-h-72 space-y-1.5 overflow-auto">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function Fila({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/60 p-2 text-sm">
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

  const { data, error, isLoading } = useEquipoHistorial(equipoId, {
    desde: desde || undefined,
    hasta: hasta || undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-lg border-border/70">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground uppercase" htmlFor="hist-desde">
              Desde
            </label>
            <Input
              className="w-44"
              id="hist-desde"
              onChange={(e) => setDesde(e.target.value)}
              type="date"
              value={desde}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground uppercase" htmlFor="hist-hasta">
              Hasta
            </label>
            <Input
              className="w-44"
              id="hist-hasta"
              onChange={(e) => setHasta(e.target.value)}
              type="date"
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
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" />
          Cargando historial...
        </div>
      )}

      {error && (
        <Card className="rounded-lg border-border/70">
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
