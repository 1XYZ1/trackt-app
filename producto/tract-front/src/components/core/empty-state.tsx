import { ClipboardList, Inbox, Search, Ticket, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmptyStateIconName } from "./types";

function renderIcon(icon: EmptyStateIconName) {
  switch (icon) {
    case "clipboard":
      return <ClipboardList className="size-6" />;
    case "inbox":
      return <Inbox className="size-6" />;
    case "search":
      return <Search className="size-6" />;
    case "ticket":
      return <Ticket className="size-6" />;
    case "wrench":
      return <Wrench className="size-6" />;
  }
}

export interface EmptyStateProps {
  icon: EmptyStateIconName;
  title: string;
  message: string;
  className?: string;
}

/**
 * Estado vacio reutilizable para listados sin datos, filtros sin resultados o modulos pendientes.
 *
 * @example
 * <EmptyState icon="ticket" title="Sin tickets" message="No hay tickets para este filtro." />
 */
export function EmptyState({ className, icon, message, title }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center dark:bg-muted/60",
        className,
      )}
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary ring-1 ring-inset ring-brand-primary/20">
        {renderIcon(icon)}
      </div>
      <h3 className="font-semibold text-base text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-pretty text-muted-foreground text-sm leading-relaxed">
        {message}
      </p>
    </div>
  );
}
