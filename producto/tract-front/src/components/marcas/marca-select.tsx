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
import { useMarcas } from "@/hooks/use-marcas";
import type { MarcaTipo } from "@/lib/api/marcas";
import { cn } from "@/lib/utils";

export type MarcaSelectProps = {
  value?: string | null;
  onChange: (marcaId: string | null) => void;
  // Filtra el catálogo por ámbito: EQUIPO trae {EQUIPO, AMBOS}, etc.
  tipo?: MarcaTipo;
  placeholder?: string;
  disabled?: boolean;
  // Permite limpiar la selección (marca opcional).
  allowClear?: boolean;
};

export function MarcaSelect({
  allowClear = true,
  disabled = false,
  onChange,
  placeholder = "Seleccionar marca",
  tipo,
  value,
}: MarcaSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: marcas = [], error, isLoading } = useMarcas(tipo ? { tipo } : {});

  const selectedMarca = marcas.find((marca) => marca.id === value);
  const filteredMarcas = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return marcas;
    return marcas.filter((marca) =>
      marca.nombre.toLowerCase().includes(normalizedQuery),
    );
  }, [marcas, query]);

  const select = (marcaId: string | null) => {
    onChange(marcaId);
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
          {selectedMarca ? selectedMarca.nombre : placeholder}
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
              placeholder="Buscar marca"
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
              Sin marca
            </button>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-6 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando marcas...
            </div>
          )}

          {!isLoading && error && (
            <div className="p-3 text-destructive text-sm">
              No se pudieron cargar las marcas.
            </div>
          )}

          {!isLoading && !error && filteredMarcas.length === 0 && (
            <div className="p-2">
              <EmptyState
                className="min-h-40 p-4"
                icon="wrench"
                message="No hay marcas en el catálogo para este ámbito."
                title="Sin marcas"
              />
            </div>
          )}

          {!isLoading &&
            !error &&
            filteredMarcas.map((marca) => (
              <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
                key={marca.id}
                onClick={() => select(marca.id)}
                type="button"
              >
                <Check
                  className={cn(
                    "size-4 text-brand-primary",
                    value === marca.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {marca.nombre}
                  </span>
                  <span className="block truncate text-muted-foreground text-xs">
                    {marca.tipo}
                  </span>
                </span>
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
