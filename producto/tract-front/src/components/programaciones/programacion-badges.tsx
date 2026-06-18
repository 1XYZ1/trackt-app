import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { Prioridad, ProgramacionEstado } from "@/lib/api/programaciones";

const ESTADO: Record<
  ProgramacionEstado,
  { label: string; variant: BadgeProps["variant"] }
> = {
  CANCELADA: { label: "Cancelada", variant: "outline" },
  COMPLETADA: { label: "Completada", variant: "success" },
  GENERADA: { label: "Generada", variant: "info" },
  PROGRAMADA: { label: "Programada", variant: "secondary" },
  VENCIDA: { label: "Vencida", variant: "error" },
};

const PRIORIDAD: Record<
  Prioridad,
  { label: string; variant: BadgeProps["variant"] }
> = {
  ALTA: { label: "Alta", variant: "error" },
  BAJA: { label: "Baja", variant: "outline" },
  MEDIA: { label: "Media", variant: "warning" },
};

export function ProgramacionEstadoBadge({
  estado,
}: {
  estado: ProgramacionEstado;
}) {
  const c = ESTADO[estado] ?? ESTADO.PROGRAMADA;
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export function PrioridadBadge({ prioridad }: { prioridad: Prioridad }) {
  const c = PRIORIDAD[prioridad] ?? PRIORIDAD.MEDIA;
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

// Color de fondo para los chips del calendario según estado.
export const ESTADO_CHIP_CLASS: Record<ProgramacionEstado, string> = {
  CANCELADA: "bg-secondary text-muted-foreground line-through",
  COMPLETADA: "bg-success/15 text-success-foreground",
  GENERADA: "bg-info/15 text-info-foreground",
  PROGRAMADA: "bg-brand-primary/15 text-foreground",
  VENCIDA: "bg-destructive/15 text-destructive-foreground",
};
