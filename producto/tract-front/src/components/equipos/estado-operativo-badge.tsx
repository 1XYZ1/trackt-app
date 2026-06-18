import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { EquipoEstadoOperativo } from "@/lib/api/equipos";

const CONFIG: Record<
  EquipoEstadoOperativo,
  { label: string; variant: BadgeProps["variant"] }
> = {
  EN_MANTENIMIENTO: { label: "En mantenimiento", variant: "warning" },
  FUERA_DE_SERVICIO: { label: "Fuera de servicio", variant: "error" },
  OPERATIVO: { label: "Operativo", variant: "success" },
};

export type EstadoOperativoBadgeProps = {
  estado: EquipoEstadoOperativo;
  className?: string;
};

export function EstadoOperativoBadge({
  className,
  estado,
}: EstadoOperativoBadgeProps) {
  const config = CONFIG[estado] ?? CONFIG.OPERATIVO;
  return (
    <Badge className={className} variant={config.variant}>
      {config.label}
    </Badge>
  );
}

export const ESTADO_OPERATIVO_LABEL: Record<EquipoEstadoOperativo, string> = {
  EN_MANTENIMIENTO: "En mantenimiento",
  FUERA_DE_SERVICIO: "Fuera de servicio",
  OPERATIVO: "Operativo",
};
