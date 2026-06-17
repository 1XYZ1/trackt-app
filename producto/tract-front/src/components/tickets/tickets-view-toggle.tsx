"use client";

import { Columns3, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type TicketsView = "kanban" | "lista";

const OPTIONS: { value: TicketsView; label: string; icon: typeof List }[] = [
  { value: "kanban", label: "Kanban", icon: Columns3 },
  { value: "lista", label: "Lista", icon: List },
];

/**
 * Conmutador segmentado kanban/lista. Control sencillo de dos botones — evita la
 * semántica de array de base-ui ToggleGroup para un valor único.
 */
export function TicketsViewToggle({
  value,
  onChange,
}: {
  value: TicketsView;
  onChange: (view: TicketsView) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border/70 bg-secondary/40 p-0.5">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = value === option.value;
        return (
          <button
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 font-medium text-xs transition-colors",
              active
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            <Icon className="size-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
