import type { TicketPrioridad } from "@/lib/api/tickets";

/** Color del punto de prioridad, consistente con el badge del detalle (ALTA = error). */
export const PRIORIDAD_DOT: Record<TicketPrioridad, string> = {
  ALTA: "bg-destructive",
  MEDIA: "bg-amber-500",
  BAJA: "bg-muted-foreground/40",
};

export const PRIORIDAD_LABEL: Record<TicketPrioridad, string> = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
};

/**
 * Fecha relativa corta en español (ej. "hace 3 d", "hace 2 h", "ahora").
 * Sin dependencias: usa Intl.RelativeTimeFormat.
 */
export function formatRelativeDate(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  const absMin = Math.abs(diffMin);
  if (absMin < 1) return "ahora";
  if (absMin < 60) return rtf.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  return rtf.format(diffMonth, "month");
}
