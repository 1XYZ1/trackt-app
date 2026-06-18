"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  CircleSlash,
  PackageCheck,
  RotateCcw,
  Sliders,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MovimientoTipo, ReservaEstado } from "@/lib/api/inventario";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

// ============================================================
// Movimientos
// ============================================================

const MOVIMIENTO_CONFIG: Record<
  MovimientoTipo,
  { label: string; variant: BadgeVariant; icon: LucideIcon }
> = {
  ENTRADA: { label: "Entrada", variant: "success", icon: ArrowDownToLine },
  SALIDA: { label: "Salida", variant: "secondary", icon: ArrowUpFromLine },
  AJUSTE: { label: "Ajuste", variant: "warning", icon: Sliders },
  RESERVA: { label: "Reserva", variant: "info", icon: PackageCheck },
  LIBERACION: { label: "Liberación", variant: "outline", icon: RotateCcw },
  CONSUMO: { label: "Consumo", variant: "secondary", icon: CircleSlash },
};

/** Badge canónico para el tipo de un movimiento de inventario. */
export function MovimientoBadge({
  className,
  tipo,
}: {
  tipo: MovimientoTipo;
  className?: string;
}) {
  const config = MOVIMIENTO_CONFIG[tipo];
  const Icon = config.icon;
  return (
    <Badge className={cn("gap-1", className)} variant={config.variant}>
      <Icon aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

/**
 * Cantidad con signo de un movimiento, coloreada según dirección.
 * Entradas suman (verde), salidas/consumos restan (atenuado).
 */
export function MovimientoCantidad({ cantidad }: { cantidad: number }) {
  const positivo = cantidad > 0;
  return (
    <span
      className={cn(
        "font-mono text-xs tabular-nums",
        positivo ? "text-success-foreground" : "text-muted-foreground",
      )}
    >
      {positivo ? `+${cantidad}` : cantidad}
    </span>
  );
}

// ============================================================
// Reservas
// ============================================================

const RESERVA_CONFIG: Record<
  ReservaEstado,
  { label: string; variant: BadgeVariant; icon: LucideIcon | null }
> = {
  SOLICITADA: { label: "Solicitada", variant: "warning", icon: null },
  RESERVADA: { label: "Reservada", variant: "info", icon: PackageCheck },
  CONSUMIDA: { label: "Consumida", variant: "secondary", icon: CheckCircle2 },
  LIBERADA: { label: "Liberada", variant: "outline", icon: RotateCcw },
  CANCELADA: { label: "Cancelada", variant: "error", icon: CircleSlash },
};

/** Badge canónico para el estado de una reserva de repuestos. */
export function ReservaEstadoBadge({
  className,
  estado,
}: {
  estado: ReservaEstado;
  className?: string;
}) {
  const config = RESERVA_CONFIG[estado];
  const Icon = config.icon;
  return (
    <Badge className={cn("gap-1", className)} variant={config.variant}>
      {Icon && <Icon aria-hidden="true" />}
      {config.label}
    </Badge>
  );
}

// ============================================================
// Stock
// ============================================================

/**
 * Badge del stock disponible. Resalta en rojo cuando está bajo el mínimo
 * para que el operador detecte faltantes de un vistazo.
 */
export function StockDisponibleBadge({
  bajoStock,
  disponible,
  className,
}: {
  disponible: number;
  bajoStock: boolean;
  className?: string;
}) {
  return (
    <Badge
      className={cn("font-mono tabular-nums", className)}
      variant={bajoStock ? "error" : "secondary"}
    >
      {disponible}
    </Badge>
  );
}

/**
 * Barra de composición del stock: muestra qué parte está reservada y qué parte
 * queda disponible respecto al stock actual. Da contexto visual inmediato
 * sobre cuánto del inventario está comprometido.
 */
export function StockBar({
  actual,
  className,
  disponible,
  reservado,
}: {
  actual: number;
  reservado: number;
  disponible: number;
  className?: string;
}) {
  const total = Math.max(actual, reservado + disponible, 1);
  const reservadoPct = Math.min(100, Math.round((reservado / total) * 100));
  const disponiblePct = Math.min(100, Math.round((disponible / total) * 100));

  return (
    <div className={cn("space-y-2", className)}>
      <div
        aria-hidden="true"
        className="flex h-2 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div className="bg-info/70" style={{ width: `${reservadoPct}%` }} />
        <div className="bg-success/70" style={{ width: `${disponiblePct}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-success/70"
          />
          Disponible{" "}
          <span className="font-mono font-medium text-foreground tabular-nums">
            {disponible}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-info/70" />
          Reservado{" "}
          <span className="font-mono font-medium text-foreground tabular-nums">
            {reservado}
          </span>
        </span>
      </div>
    </div>
  );
}
