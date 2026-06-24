"use client";

import { type ReactNode } from "react";
import { AlertTriangle, Package, PackageCheck, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MovimientoBadge,
  MovimientoCantidad,
  StockBar,
} from "@/components/inventario";
import { useRepuestoByQr } from "@/hooks/use-inventario";

// Ficha mobile del repuesto a la que llega el QR (/r/[token]). Versión simple:
// identidad + composición de stock + últimos movimientos. Espejo del
// EquipoQrClient pero sin acciones (el repuesto no cambia de estado en terreno).
export function RepuestoQrClient({ token }: { token: string }) {
  const { data: repuesto, error, isLoading } = useRepuestoByQr(token);

  if (isLoading) {
    return <RepuestoQrSkeleton />;
  }

  if (error || !repuesto) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="font-semibold text-base">Repuesto no encontrado</h1>
        <p className="mt-1.5 max-w-xs text-pretty text-muted-foreground text-sm leading-relaxed">
          No se encontró el repuesto de este código QR, o no pertenece a tu
          organización.
        </p>
      </div>
    );
  }

  const movimientos = repuesto.movimientosRecientes ?? [];

  return (
    <div className="space-y-5 pb-4">
      {/* Cabecera */}
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-muted-foreground text-xs">
            {repuesto.codigo}
          </span>
          <div className="flex items-center gap-2">
            {repuesto.bajoStock && (
              <Badge variant="error">
                <AlertTriangle className="size-3" />
                Bajo stock
              </Badge>
            )}
            <Badge variant={repuesto.activo ? "success" : "outline"}>
              {repuesto.activo ? "Activo" : "Inactivo"}
            </Badge>
          </div>
        </div>
        <h1 className="text-balance font-semibold text-2xl leading-tight tracking-tight">
          {repuesto.nombre}
        </h1>
        <div className="space-y-1 text-muted-foreground text-sm">
          {[repuesto.categoria, repuesto.marca?.nombre]
            .filter(Boolean)
            .join(" · ") && (
            <p>
              {[repuesto.categoria, repuesto.marca?.nombre]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {repuesto.ubicacionBodega && (
            <p className="flex items-center gap-1.5">
              <Warehouse className="size-3.5 shrink-0" />
              {repuesto.ubicacionBodega}
            </p>
          )}
        </div>
      </header>

      {/* Estadísticas de stock */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard
          icon={<Warehouse className="size-4" />}
          label="Actual"
          value={repuesto.stockActual}
        />
        <StatCard
          highlight={repuesto.bajoStock}
          icon={<Package className="size-4" />}
          label="Disponible"
          value={repuesto.stockDisponible}
        />
        <StatCard
          icon={<PackageCheck className="size-4" />}
          label="Reservado"
          value={repuesto.stockReservado}
        />
      </div>

      {/* Composición del stock */}
      <section className="space-y-2.5">
        <SectionLabel>Composición del stock</SectionLabel>
        <Card>
          <CardContent className="p-4">
            <StockBar
              actual={repuesto.stockActual}
              disponible={repuesto.stockDisponible}
              reservado={repuesto.stockReservado}
            />
          </CardContent>
        </Card>
      </section>

      {/* Últimos movimientos */}
      <section className="space-y-2.5">
        <SectionLabel>Últimos movimientos</SectionLabel>
        {movimientos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-1 px-4 py-8 text-center">
              <Package className="size-5 text-muted-foreground/70" />
              <p className="text-muted-foreground text-sm">
                Este repuesto todavía no tiene movimientos de stock.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {movimientos.map((m) => (
              <div
                className="flex items-center gap-3 rounded-xl border bg-card p-3.5"
                key={m.id}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <MovimientoBadge tipo={m.tipo} />
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {new Date(m.createdAt).toLocaleString("es-CL")}
                  </p>
                  {m.observacion && (
                    <p className="truncate text-muted-foreground text-xs">
                      {m.observacion}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <MovimientoCantidad cantidad={m.cantidad} />
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    → {m.stockResultante}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
      {children}
    </h2>
  );
}

function StatCard({
  highlight = false,
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "flex flex-col items-center gap-1.5 rounded-xl border border-warning/30 bg-warning/8 p-3 text-center dark:bg-warning/12"
          : "flex flex-col items-center gap-1.5 rounded-xl border bg-card p-3 text-center"
      }
    >
      <span
        className={
          highlight ? "text-warning-foreground" : "text-muted-foreground"
        }
      >
        {icon}
      </span>
      <span
        className={
          highlight
            ? "font-semibold text-warning-foreground text-xl tabular-nums leading-none"
            : "font-semibold text-xl tabular-nums leading-none"
        }
      >
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground leading-tight">
        {label}
      </span>
    </div>
  );
}

function RepuestoQrSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
        <Skeleton className="h-8 w-3/4 rounded-md" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <Skeleton className="h-[88px] rounded-xl" />
        <Skeleton className="h-[88px] rounded-xl" />
        <Skeleton className="h-[88px] rounded-xl" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-[68px] w-full rounded-xl" />
        <Skeleton className="h-[68px] w-full rounded-xl" />
      </div>
    </div>
  );
}
