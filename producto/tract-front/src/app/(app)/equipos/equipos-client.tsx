"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, PowerOff, Search, Truck } from "lucide-react";
import { EmptyState } from "@/components/core";
import { DesactivarEquipoDialog, EquipoFormSheet } from "@/components/equipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useHasRole } from "@/contexts/auth-context";
import { useEquipos } from "@/hooks/use-equipos";
import type { Equipo } from "@/lib/api/equipos";

export function EquiposClient() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Equipo | null>(null);
  const [toDeactivate, setToDeactivate] = useState<Equipo | null>(null);

  const isAdmin = useHasRole("admin");

  // Debounce 300ms para que el search server-side no dispare a cada tecla.
  useEffect(() => {
    const trimmed = query.trim();
    const t = setTimeout(() => setDebouncedQuery(trimmed), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: equipos = [], error, isLoading } = useEquipos({
    includeInactive,
    search: debouncedQuery || undefined,
  });

  const filteredEquipos = equipos;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (equipo: Equipo) => {
    setEditing(equipo);
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
            <Truck className="size-3.5" />
            Flota operacional
          </div>
          <h1 className="font-semibold text-2xl tracking-tight">Equipos</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
            Listado de equipos operacionales registrados para mantenimiento.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-7"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar codigo, nombre o ubicacion"
              type="search"
              value={query}
            />
          </div>
          {isAdmin && (
            <Button onClick={openCreate} size="sm">
              <Plus />
              Agregar equipo
            </Button>
          )}
        </div>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Equipos registrados</CardTitle>
            <p className="text-muted-foreground text-xs">
              {filteredEquipos.length} resultado
              {filteredEquipos.length === 1 ? "" : "s"} disponibles.
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
              Incluir inactivos
            </label>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center gap-2 px-5 py-16 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando equipos...
            </div>
          )}

          {!isLoading && error && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="No se pudieron cargar los equipos desde la API. Revisa la conexion o el endpoint GET /equipos."
                title="Error al cargar equipos"
              />
            </div>
          )}

          {!isLoading && !error && equipos.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="Crea el primer equipo para iniciar el registro de la flota operacional."
                title="No hay equipos registrados"
              />
              {isAdmin && (
                <div className="mt-4 flex justify-center">
                  <Button onClick={openCreate}>
                    <Plus />
                    Agregar equipo
                  </Button>
                </div>
              )}
            </div>
          )}

          {!isLoading && !error && equipos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3 font-semibold">Codigo</th>
                    <th className="px-5 py-3 font-semibold">Nombre</th>
                    <th className="px-5 py-3 font-semibold">Marca</th>
                    <th className="px-5 py-3 font-semibold">Modelo</th>
                    <th className="px-5 py-3 font-semibold">Ubicacion</th>
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
                  {filteredEquipos.length === 0 && (
                    <tr>
                      <td
                        className="px-5 py-14 text-center"
                        colSpan={
                          5 + (includeInactive ? 1 : 0) + (isAdmin ? 1 : 0)
                        }
                      >
                        <EmptyState
                          className="border-0 bg-transparent"
                          icon="search"
                          message="Ajusta la busqueda para encontrar otro equipo."
                          title="Sin resultados"
                        />
                      </td>
                    </tr>
                  )}

                  {filteredEquipos.map((equipo) => {
                    const inactive = equipo.activo === false;
                    return (
                      <tr
                        className="border-border/60 border-b transition-colors last:border-0 hover:bg-secondary/25"
                        key={equipo.id}
                      >
                        <td className="whitespace-nowrap px-5 py-3.5 font-mono font-semibold text-xs">
                          {equipo.codigo}
                        </td>
                        <td className="px-5 py-3.5 font-medium">{equipo.nombre}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground text-xs">
                          {equipo.marca}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground text-xs">
                          {equipo.modelo}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <Badge variant="secondary">{equipo.ubicacion}</Badge>
                        </td>
                        {includeInactive && (
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <Badge variant={inactive ? "outline" : "default"}>
                              {inactive ? "Inactivo" : "Activo"}
                            </Badge>
                          </td>
                        )}
                        {isAdmin && (
                          <td className="whitespace-nowrap px-5 py-3.5 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                onClick={() => openEdit(equipo)}
                                size="sm"
                                variant="ghost"
                              >
                                <Pencil />
                                Editar
                              </Button>
                              <Button
                                disabled={inactive}
                                onClick={() => setToDeactivate(equipo)}
                                size="sm"
                                variant="destructive-outline"
                              >
                                <PowerOff />
                                Desactivar
                              </Button>
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
          <EquipoFormSheet
            equipo={editing}
            onOpenChange={handleFormOpenChange}
            open={formOpen}
          />
          <DesactivarEquipoDialog
            equipo={toDeactivate}
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
