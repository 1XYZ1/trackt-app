"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { EmptyState } from "@/components/core";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useEquipos } from "@/hooks/use-equipos";
import { cn } from "@/lib/utils";

export type EquipoSelectProps = {
  value?: string;
  onChange: (equipoId: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function EquipoSelect({
  disabled = false,
  onChange,
  placeholder = "Seleccionar equipo",
  value,
}: EquipoSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: equipos = [], error, isLoading } = useEquipos();

  const selectedEquipo = equipos.find((equipo) => equipo.id === value);
  const filteredEquipos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return equipos;

    return equipos.filter(
      (equipo) =>
        equipo.codigo.toLowerCase().includes(normalizedQuery) ||
        equipo.nombre.toLowerCase().includes(normalizedQuery),
    );
  }, [equipos, query]);

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
          {selectedEquipo
            ? `${selectedEquipo.codigo} - ${selectedEquipo.nombre}`
            : placeholder}
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
              placeholder="Buscar por codigo o nombre"
              value={query}
            />
          </div>
        </div>

        <div className="max-h-72 overflow-auto p-1">
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-6 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando equipos...
            </div>
          )}

          {!isLoading && error && (
            <div className="p-3 text-destructive text-sm">
              No se pudieron cargar los equipos.
            </div>
          )}

          {!isLoading && !error && filteredEquipos.length === 0 && (
            <div className="p-2">
              <EmptyState
                className="min-h-40 p-4"
                icon="wrench"
                message="Intenta buscar por otro codigo o nombre."
                title="No hay equipos"
              />
            </div>
          )}

          {!isLoading &&
            !error &&
            filteredEquipos.map((equipo) => (
              <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
                key={equipo.id}
                onClick={() => {
                  onChange(equipo.id);
                  setOpen(false);
                  setQuery("");
                }}
                type="button"
              >
                <Check
                  className={cn(
                    "size-4 text-brand-primary",
                    value === equipo.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {equipo.codigo} - {equipo.nombre}
                  </span>
                  <span className="block truncate text-muted-foreground text-xs">
                    {equipo.marca} {equipo.modelo}
                    {equipo.ubicacion ? ` - ${equipo.ubicacion}` : ""}
                  </span>
                </span>
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
