import {
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock3,
  PlayCircle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TracktEstado } from "./types";

const statusConfig = {
  ASIGNADO: {
    className:
      "border-estado-asignado-border bg-estado-asignado-bg text-estado-asignado-text",
    dotClassName: "bg-estado-asignado-dot",
    icon: CircleDashed,
    label: "Asignado",
  },
  CANCELADO: {
    className:
      "border-estado-cancelado-border bg-estado-cancelado-bg text-estado-cancelado-text",
    dotClassName: "bg-estado-cancelado-dot",
    icon: XCircle,
    label: "Cancelado",
  },
  CERRADO: {
    className:
      "border-estado-cerrado-border bg-estado-cerrado-bg text-estado-cerrado-text",
    dotClassName: "bg-estado-cerrado-dot",
    icon: CheckCircle2,
    label: "Cerrado",
  },
  EJECUTADO: {
    className:
      "border-estado-ejecutado-border bg-estado-ejecutado-bg text-estado-ejecutado-text",
    dotClassName: "bg-estado-ejecutado-dot",
    icon: CheckCircle2,
    label: "Ejecutado",
  },
  EN_EJECUCION: {
    className:
      "border-estado-en-ejecucion-border bg-estado-en-ejecucion-bg text-estado-en-ejecucion-text",
    dotClassName: "bg-estado-en-ejecucion-dot",
    icon: PlayCircle,
    label: "En ejecucion",
  },
  PENDIENTE: {
    className:
      "border-estado-pendiente-border bg-estado-pendiente-bg text-estado-pendiente-text",
    dotClassName: "bg-estado-pendiente-dot",
    icon: Clock3,
    label: "Pendiente",
  },
} satisfies Record<
  TracktEstado,
  {
    className: string;
    dotClassName: string;
    icon: typeof Circle;
    label: string;
  }
>;

export interface StatusBadgeProps {
  estado: TracktEstado;
  className?: string;
  showIcon?: boolean;
}

/**
 * Badge canonico para estados de tickets y ordenes de trabajo.
 *
 * @example
 * <StatusBadge estado="EN_EJECUCION" />
 */
export function StatusBadge({
  className,
  estado,
  showIcon = true,
}: StatusBadgeProps) {
  const config = statusConfig[estado];
  const Icon = config.icon;

  return (
    <Badge
      className={cn(
        "h-6 rounded-md border px-2 font-semibold",
        config.className,
        className,
      )}
      variant="outline"
    >
      <span
        className={cn("size-1.5 rounded-full animate-pulse-dot", config.dotClassName)}
      />
      {showIcon && <Icon className="size-3.5" />}
      {config.label}
    </Badge>
  );
}
