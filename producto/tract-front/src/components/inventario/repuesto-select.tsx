"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { EmptyState } from "@/components/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRepuestos } from "@/hooks/use-inventario";
import { cn } from "@/lib/utils";
import { StockDisponibleBadge } from "./inventario-ui";

export type RepuestoSelectProps = {
  value?: string;
  onChange: (repuestoId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  // Oculta repuestos ya seleccionados/asociados.
  excludeIds?: string[];
};

export function RepuestoSelect({
  disabled = false,
  excludeIds = [],
  onChange,
  placeholder = "Seleccionar repuesto",
  value,
}: RepuestoSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: repuestos = [], error, isLoading } = useRepuestos();

  const selected = repuestos.find((r) => r.id === value);
  const filtered = useMemo(() => {
    const exclude = new Set(excludeIds);
    const q = query.trim().toLowerCase();
    return repuestos.filter((r) => {
      if (exclude.has(r.id)) return false;
      if (!q) return true;
      return (
        r.codigo.toLowerCase().includes(q) ||
        r.nombre.toLowerCase().includes(q)
      );
    });
  }, [repuestos, query, excludeIds]);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-label={placeholder}
            className="w-full justify-between font-normal"
            disabled={disabled}
            variant="outline"
          />
        }
      >
        <span
          className={cn(
            "min-w-0 truncate text-left",
            !selected && "text-muted-foreground",
          )}
        >
          {selected ? `${selected.codigo} - ${selected.nombre}` : placeholder}
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
              aria-label="Buscar repuesto"
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por código o nombre"
              value={query}
            />
          </div>
        </div>

        <div className="max-h-72 overflow-auto p-1">
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-6 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando repuestos...
            </div>
          )}

          {!isLoading && error && (
            <div className="p-3 text-destructive text-sm">
              No se pudieron cargar los repuestos.
            </div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="p-2">
              <EmptyState
                className="min-h-40 p-4"
                icon="search"
                message={
                  query
                    ? "Ningún repuesto coincide con la búsqueda."
                    : "No hay repuestos disponibles para seleccionar."
                }
                title="Sin repuestos"
              />
            </div>
          )}

          {!isLoading &&
            !error &&
            filtered.map((repuesto) => {
              const isSelected = value === repuesto.id;
              return (
                <button
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected && "bg-secondary/60",
                  )}
                  key={repuesto.id}
                  onClick={() => {
                    onChange(repuesto.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  type="button"
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0 text-brand-primary",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {repuesto.codigo} - {repuesto.nombre}
                    </span>
                    <span className="block truncate text-muted-foreground text-xs">
                      Disponible: {repuesto.stockDisponible} {repuesto.unidad}
                    </span>
                  </span>
                  <StockDisponibleBadge
                    bajoStock={repuesto.bajoStock}
                    className="shrink-0"
                    disponible={repuesto.stockDisponible}
                  />
                </button>
              );
            })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
