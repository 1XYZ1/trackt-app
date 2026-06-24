"use client";

import { useEffect, useState } from "react";
import {
  Boxes,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/core";
import {
  DesactivarTipoEquipoDialog,
  TipoEquipoFormSheet,
  TipoEquipoRepuestos,
} from "@/components/tipos-equipo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import { useHasRole } from "@/contexts/auth-context";
import {
  useReactivarTipoEquipo,
  useTiposEquipo,
} from "@/hooks/use-tipos-equipo";
import type { TipoEquipo } from "@/lib/api/tipos-equipo";

export function TiposEquipoClient() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TipoEquipo | null>(null);
  const [toDeactivate, setToDeactivate] = useState<TipoEquipo | null>(null);
  const [reactivarId, setReactivarId] = useState<string | null>(null);
  const [repuestosFor, setRepuestosFor] = useState<TipoEquipo | null>(null);

  const isAdmin = useHasRole("admin");
  const reactivar = useReactivarTipoEquipo();

  const handleReactivar = (tipo: TipoEquipo) => {
    setReactivarId(tipo.id);
    reactivar.mutate(tipo.id, {
      onSuccess: () => toast.success(`Tipo ${tipo.nombre} reactivado`),
      onError: (err) =>
        toast.error(
          err instanceof Error
            ? err.message
            : "No se pudo reactivar el tipo de equipo",
        ),
      onSettled: () => setReactivarId(null),
    });
  };

  useEffect(() => {
    const trimmed = query.trim();
    const t = setTimeout(() => setDebouncedQuery(trimmed), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: tipos = [], error, isLoading } = useTiposEquipo({
    includeInactive,
    search: debouncedQuery || undefined,
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (tipo: TipoEquipo) => {
    setEditing(tipo);
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
            <Boxes className="size-3.5" />
            Catálogo
          </div>
          <h1 className="font-semibold text-2xl tracking-tight">
            Tipos de equipo
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
            Tipos reutilizables al registrar equipos, con repuestos default que
            se autocompletan al crear el equipo.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar tipo de equipo"
              type="search"
              value={query}
            />
          </div>
          {isAdmin && (
            <Button onClick={openCreate} size="sm">
              <Plus />
              Agregar tipo
            </Button>
          )}
        </div>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="flex-col items-stretch gap-3 space-y-0 pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Tipos registrados</CardTitle>
              <p className="text-muted-foreground text-xs">
                {tipos.length} resultado{tipos.length === 1 ? "" : "s"}.
              </p>
            </div>
            {isAdmin && (
              <Label
                className="flex items-center gap-2 text-muted-foreground text-xs"
                htmlFor="incluir-inactivos"
              >
                <Checkbox
                  checked={includeInactive}
                  id="incluir-inactivos"
                  onCheckedChange={(checked) =>
                    setIncludeInactive(checked === true)
                  }
                />
                Incluir inactivos
              </Label>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center gap-2 px-5 py-16 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando tipos de equipo...
            </div>
          )}

          {!isLoading && error && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="No se pudieron cargar los tipos de equipo desde la API. Revisa la conexión o el endpoint GET /tipos-equipo."
                title="Error al cargar tipos de equipo"
              />
            </div>
          )}

          {!isLoading && !error && tipos.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="Crea el primer tipo de equipo del catálogo para reutilizarlo al registrar equipos."
                title="No hay tipos de equipo registrados"
              />
              {isAdmin && (
                <div className="mt-4 flex justify-center">
                  <Button onClick={openCreate}>
                    <Plus />
                    Agregar tipo
                  </Button>
                </div>
              )}
            </div>
          )}

          {!isLoading && !error && tipos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3 font-semibold">Nombre</th>
                    <th className="px-5 py-3 font-semibold">Descripción</th>
                    {includeInactive && (
                      <th className="px-5 py-3 font-semibold">Estado</th>
                    )}
                    <th className="px-5 py-3 text-right font-semibold">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tipos.map((tipo) => {
                    const inactive = tipo.activo === false;
                    return (
                      <tr
                        className="border-border/60 border-b transition-colors last:border-0 hover:bg-secondary/25"
                        key={tipo.id}
                      >
                        <td className="px-5 py-3.5 font-medium">{tipo.nombre}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">
                          {tipo.descripcion ?? "—"}
                        </td>
                        {includeInactive && (
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <Badge variant={inactive ? "outline" : "default"}>
                              {inactive ? "Inactivo" : "Activo"}
                            </Badge>
                          </td>
                        )}
                        <td className="whitespace-nowrap px-5 py-3.5 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              onClick={() => setRepuestosFor(tipo)}
                              size="sm"
                              variant="ghost"
                            >
                              <Wrench />
                              Repuestos
                            </Button>
                            {isAdmin && (
                              <>
                                <Button
                                  onClick={() => openEdit(tipo)}
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
                                      reactivarId === tipo.id
                                    }
                                    onClick={() => handleReactivar(tipo)}
                                    size="sm"
                                    variant="outline"
                                  >
                                    <Power />
                                    Reactivar
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={() => setToDeactivate(tipo)}
                                    size="sm"
                                    variant="destructive-outline"
                                  >
                                    <PowerOff />
                                    Desactivar
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor de repuestos default por tipo (lectura para todos, gestión admin). */}
      <Sheet
        onOpenChange={(open) => {
          if (!open) setRepuestosFor(null);
        }}
        open={Boolean(repuestosFor)}
      >
        <SheetPopup className="max-w-2xl">
          <SheetHeader>
            <SheetTitle>
              Repuestos default
              {repuestosFor ? ` · ${repuestosFor.nombre}` : ""}
            </SheetTitle>
            <SheetDescription>
              Repuestos que se asocian automáticamente a un equipo al crearlo con
              este tipo.
            </SheetDescription>
          </SheetHeader>
          <SheetPanel>
            {repuestosFor && (
              <TipoEquipoRepuestos tipoEquipoId={repuestosFor.id} />
            )}
          </SheetPanel>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" />}>Cerrar</SheetClose>
          </SheetFooter>
        </SheetPopup>
      </Sheet>

      {isAdmin && (
        <>
          <TipoEquipoFormSheet
            onOpenChange={handleFormOpenChange}
            open={formOpen}
            tipoEquipo={editing}
          />
          <DesactivarTipoEquipoDialog
            onOpenChange={(open) => {
              if (!open) setToDeactivate(null);
            }}
            open={Boolean(toDeactivate)}
            tipoEquipo={toDeactivate}
          />
        </>
      )}
    </div>
  );
}
