"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { EmptyState } from "@/components/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePlantillas } from "@/hooks/use-plantillas";
import { cn } from "@/lib/utils";

export type PlantillaSelectProps = {
  value?: string | null;
  onChange: (plantillaId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  excludeIds?: string[];
};

export function PlantillaSelect({
  allowClear = true,
  disabled = false,
  excludeIds = [],
  onChange,
  placeholder = "Seleccionar plantilla",
  value,
}: PlantillaSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: plantillas = [], error, isLoading } = usePlantillas();

  const selected = plantillas.find((p) => p.id === value);
  const filtered = useMemo(() => {
    const exclude = new Set(excludeIds);
    const q = query.trim().toLowerCase();
    return plantillas.filter((p) => {
      if (exclude.has(p.id)) return false;
      if (!q) return true;
      return p.nombre.toLowerCase().includes(q);
    });
  }, [plantillas, query, excludeIds]);

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
          {selected ? selected.nombre : placeholder}
        </span>
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ChevronsUpDown className="size-4 opacity-70" />
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-border border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-7"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar plantilla"
              value={query}
            />
          </div>
        </div>

        <div className="max-h-72 overflow-auto p-1">
          {allowClear && (
            <button
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-muted-foreground text-sm hover:bg-secondary"
              onClick={() => select(null)}
              type="button"
            >
              <X className="size-4" />
              Sin plantilla
            </button>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-6 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando plantillas...
            </div>
          )}

          {!isLoading && error && (
            <div className="p-3 text-destructive text-sm">
              No se pudieron cargar las plantillas.
            </div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="p-2">
              <EmptyState
                className="min-h-40 p-4"
                icon="wrench"
                message="No hay plantillas disponibles."
                title="Sin plantillas"
              />
            </div>
          )}

          {!isLoading &&
            !error &&
            filtered.map((plantilla) => (
              <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
                key={plantilla.id}
                onClick={() => select(plantilla.id)}
                type="button"
              >
                <Check
                  className={cn(
                    "size-4 text-brand-primary",
                    value === plantilla.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {plantilla.nombre}
                  </span>
                  <span className="block truncate text-muted-foreground text-xs">
                    {plantilla.itemsCount} ítem
                    {plantilla.itemsCount === 1 ? "" : "s"}
                    {plantilla.tipoEquipo ? ` · ${plantilla.tipoEquipo}` : ""}
                  </span>
                </span>
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
