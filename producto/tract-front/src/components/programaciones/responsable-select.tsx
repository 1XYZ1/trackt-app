"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCargaMecanicos } from "@/hooks/use-tickets";
import { cn } from "@/lib/utils";

export type ResponsableSelectProps = {
  value?: string | null;
  onChange: (responsableId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
};

// Lista mecánicos (accesible a admin y jefe_taller) como candidatos a responsable.
export function ResponsableSelect({
  disabled = false,
  onChange,
  placeholder = "Sin responsable",
  value,
}: ResponsableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: mecanicos = [], error, isLoading } = useCargaMecanicos();

  const selected = mecanicos.find((m) => m.mecanicoId === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mecanicos;
    return mecanicos.filter((m) =>
      (m.nombre ?? m.email ?? m.mecanicoId).toLowerCase().includes(q),
    );
  }, [mecanicos, query]);

  const label = (m: { nombre: string | null; email: string | null; mecanicoId: string }) =>
    m.nombre ?? m.email ?? m.mecanicoId;

  const select = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            className="w-full justify-between"
            disabled={disabled}
            variant="outline"
          />
        }
      >
        <span className="min-w-0 truncate text-left">
          {selected ? label(selected) : placeholder}
        </span>
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ChevronsUpDown className="size-4 opacity-70" />
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-border border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-7"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar mecánico"
              value={query}
            />
          </div>
        </div>

        <div className="max-h-72 overflow-auto p-1">
          <button
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-muted-foreground text-sm hover:bg-secondary"
            onClick={() => select(null)}
            type="button"
          >
            <X className="size-4" />
            Sin responsable
          </button>

          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-6 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando mecánicos...
            </div>
          )}

          {!isLoading && error && (
            <div className="p-3 text-destructive text-sm">
              No se pudieron cargar los mecánicos.
            </div>
          )}

          {!isLoading &&
            !error &&
            filtered.map((m) => (
              <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
                key={m.mecanicoId}
                onClick={() => select(m.mecanicoId)}
                type="button"
              >
                <Check
                  className={cn(
                    "size-4 text-brand-primary",
                    value === m.mecanicoId ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{label(m)}</span>
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
