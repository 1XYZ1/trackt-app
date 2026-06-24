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
import { useTiposEquipo } from "@/hooks/use-tipos-equipo";
import { cn } from "@/lib/utils";

export type TipoEquipoSelectProps = {
  value?: string | null;
  onChange: (tipoEquipoId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  // Permite limpiar la selección (tipo opcional).
  allowClear?: boolean;
};

export function TipoEquipoSelect({
  allowClear = true,
  disabled = false,
  onChange,
  placeholder = "Seleccionar tipo de equipo",
  value,
}: TipoEquipoSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Solo tipos activos: el combo del formulario de equipos no debe ofrecer
  // tipos desactivados. Si el equipo editado referencia uno inactivo, igual se
  // muestra su nombre cuando viene en la lista (el backend lo incluiría).
  const { data: tipos = [], error, isLoading } = useTiposEquipo();

  const selectedTipo = tipos.find((tipo) => tipo.id === value);
  const filteredTipos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return tipos;
    return tipos.filter((tipo) =>
      tipo.nombre.toLowerCase().includes(normalizedQuery),
    );
  }, [tipos, query]);

  const select = (tipoEquipoId: string | null) => {
    onChange(tipoEquipoId);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            className="w-full justify-between font-normal"
            disabled={disabled}
            variant="outline"
          />
        }
      >
        <span
          className={cn(
            "min-w-0 truncate text-left",
            !selectedTipo && "text-muted-foreground",
          )}
        >
          {selectedTipo ? selectedTipo.nombre : placeholder}
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
              placeholder="Buscar tipo"
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
              Sin tipo
            </button>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-6 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando tipos...
            </div>
          )}

          {!isLoading && error && (
            <div className="p-3 text-destructive text-sm">
              No se pudieron cargar los tipos de equipo.
            </div>
          )}

          {!isLoading && !error && filteredTipos.length === 0 && (
            <div className="p-2">
              <EmptyState
                className="min-h-40 p-4"
                icon="wrench"
                message="No hay tipos de equipo en el catálogo."
                title="Sin tipos"
              />
            </div>
          )}

          {!isLoading &&
            !error &&
            filteredTipos.map((tipo) => (
              <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
                key={tipo.id}
                onClick={() => select(tipo.id)}
                type="button"
              >
                <Check
                  className={cn(
                    "size-4 shrink-0 text-brand-primary",
                    value === tipo.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {tipo.nombre}
                  </span>
                  {tipo.descripcion && (
                    <span className="block truncate text-muted-foreground text-xs">
                      {tipo.descripcion}
                    </span>
                  )}
                </span>
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
