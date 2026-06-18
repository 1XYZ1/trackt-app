"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Power, PowerOff, Search, Tag } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/core";
import { DesactivarMarcaDialog, MarcaFormSheet } from "@/components/marcas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useHasRole } from "@/contexts/auth-context";
import { useMarcas, useReactivarMarca } from "@/hooks/use-marcas";
import type { Marca, MarcaTipo } from "@/lib/api/marcas";
import { cn } from "@/lib/utils";

const TIPO_LABEL: Record<MarcaTipo, string> = {
  AMBOS: "Ambos",
  EQUIPO: "Equipo",
  REPUESTO: "Repuesto",
};

type TipoFilter = "TODOS" | MarcaTipo;

const TIPO_FILTERS: { label: string; value: TipoFilter }[] = [
  { label: "Todos", value: "TODOS" },
  { label: "Equipo", value: "EQUIPO" },
  { label: "Repuesto", value: "REPUESTO" },
  { label: "Ambos", value: "AMBOS" },
];

export function MarcasClient() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("TODOS");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Marca | null>(null);
  const [toDeactivate, setToDeactivate] = useState<Marca | null>(null);
  const [reactivarId, setReactivarId] = useState<string | null>(null);

  const isAdmin = useHasRole("admin");
  const reactivar = useReactivarMarca();

  const handleReactivar = (marca: Marca) => {
    setReactivarId(marca.id);
    reactivar.mutate(marca.id, {
      onSuccess: () => toast.success(`Marca ${marca.nombre} reactivada`),
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : "No se pudo reactivar la marca",
        ),
      onSettled: () => setReactivarId(null),
    });
  };

  useEffect(() => {
    const trimmed = query.trim();
    const t = setTimeout(() => setDebouncedQuery(trimmed), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: marcas = [], error, isLoading } = useMarcas({
    includeInactive,
    search: debouncedQuery || undefined,
    tipo: tipoFilter === "TODOS" ? undefined : tipoFilter,
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (marca: Marca) => {
    setEditing(marca);
    setFormOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditing(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
            <Tag className="size-3.5" />
            Catálogo
          </div>
          <h1 className="font-semibold text-2xl tracking-tight">Marcas</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
            Marcas reutilizables para equipos y repuestos.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-7"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar marca"
              type="search"
              value={query}
            />
          </div>
          {isAdmin && (
            <Button onClick={openCreate} size="sm">
              <Plus />
              Agregar marca
            </Button>
          )}
        </div>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="flex-col items-stretch gap-3 space-y-0 pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Marcas registradas</CardTitle>
              <p className="text-muted-foreground text-xs">
                {marcas.length} resultado{marcas.length === 1 ? "" : "s"}.
              </p>
            </div>
            {isAdmin && (
              <label className="flex items-center gap-2 text-muted-foreground text-xs">
                <input
                  checked={includeInactive}
                  className="size-3.5"
                  onChange={(event) => setIncludeInactive(event.target.checked)}
                  type="checkbox"
                />
                Incluir inactivas
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TIPO_FILTERS.map((filter) => (
              <button
                className={cn(
                  "rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-secondary/60",
                  tipoFilter === filter.value &&
                    "border-brand-primary/50 bg-brand-primary/10 text-foreground",
                )}
                key={filter.value}
                onClick={() => setTipoFilter(filter.value)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center gap-2 px-5 py-16 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando marcas...
            </div>
          )}

          {!isLoading && error && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="No se pudieron cargar las marcas desde la API. Revisa la conexión o el endpoint GET /marcas."
                title="Error al cargar marcas"
              />
            </div>
          )}

          {!isLoading && !error && marcas.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="Crea la primera marca del catálogo para reutilizarla en equipos y repuestos."
                title="No hay marcas registradas"
              />
              {isAdmin && (
                <div className="mt-4 flex justify-center">
                  <Button onClick={openCreate}>
                    <Plus />
                    Agregar marca
                  </Button>
                </div>
              )}
            </div>
          )}

          {!isLoading && !error && marcas.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3 font-semibold">Nombre</th>
                    <th className="px-5 py-3 font-semibold">Tipo</th>
                    {includeInactive && (
                      <th className="px-5 py-3 font-semibold">Estado</th>
                    )}
                    {isAdmin && (
                      <th className="px-5 py-3 text-right font-semibold">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {marcas.map((marca) => {
                    const inactive = marca.activo === false;
                    return (
                      <tr
                        className="border-border/60 border-b transition-colors last:border-0 hover:bg-secondary/25"
                        key={marca.id}
                      >
                        <td className="px-5 py-3.5 font-medium">{marca.nombre}</td>
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <Badge variant="secondary">
                            {TIPO_LABEL[marca.tipo]}
                          </Badge>
                        </td>
                        {includeInactive && (
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <Badge variant={inactive ? "outline" : "default"}>
                              {inactive ? "Inactiva" : "Activa"}
                            </Badge>
                          </td>
                        )}
                        {isAdmin && (
                          <td className="whitespace-nowrap px-5 py-3.5 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                onClick={() => openEdit(marca)}
                                size="sm"
                                variant="ghost"
                              >
                                <Pencil />
                                Editar
                              </Button>
                              {inactive ? (
                                <Button
                                  loading={
                                    reactivar.isPending &&
                                    reactivarId === marca.id
                                  }
                                  onClick={() => handleReactivar(marca)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Power />
                                  Reactivar
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => setToDeactivate(marca)}
                                  size="sm"
                                  variant="destructive-outline"
                                >
                                  <PowerOff />
                                  Desactivar
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <>
          <MarcaFormSheet
            marca={editing}
            onOpenChange={handleFormOpenChange}
            open={formOpen}
          />
          <DesactivarMarcaDialog
            marca={toDeactivate}
            onOpenChange={(open) => {
              if (!open) setToDeactivate(null);
            }}
            open={Boolean(toDeactivate)}
          />
        </>
      )}
    </div>
  );
}
