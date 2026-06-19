"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Truck,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState, TableSkeleton } from "@/components/core";
import {
  DesactivarEquipoDialog,
  EquipoFormSheet,
  EstadoOperativoBadge,
} from "@/components/equipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipPopup,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHasRole } from "@/contexts/auth-context";
import {
  useEquipos,
  usePrefetchEquipo,
  useReactivarEquipo,
} from "@/hooks/use-equipos";
import { EQUIPOS_PAGE_LIMIT, type Equipo } from "@/lib/api/equipos";

export function EquiposClient() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Equipo | null>(null);
  const [toDeactivate, setToDeactivate] = useState<Equipo | null>(null);
  const [reactivarId, setReactivarId] = useState<string | null>(null);

  const isAdmin = useHasRole("admin");
  const reactivar = useReactivarEquipo();
  const prefetchEquipo = usePrefetchEquipo();

  const handleReactivar = (equipo: Equipo) => {
    setReactivarId(equipo.id);
    reactivar.mutate(equipo.id, {
      onSuccess: () => toast.success(`Equipo ${equipo.codigo} reactivado`),
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : "No se pudo reactivar el equipo",
        ),
      onSettled: () => setReactivarId(null),
    });
  };

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

  const summary = useMemo(() => {
    let operativos = 0;
    let conAlerta = 0;
    let inactivos = 0;
    for (const e of equipos) {
      if (e.activo === false) inactivos += 1;
      if (e.estadoOperativo === "OPERATIVO") operativos += 1;
      else if (e.activo !== false) conAlerta += 1;
    }
    return { conAlerta, inactivos, operativos };
  }, [equipos]);

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

  const colSpan = 6 + (includeInactive ? 1 : 0) + (isAdmin ? 1 : 0);

  return (
    <TooltipProvider>
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
                aria-label="Buscar equipos"
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar código, nombre o ubicación"
                type="search"
                value={query}
              />
            </div>
            {isAdmin && (
              <Button className="shrink-0" onClick={openCreate} size="sm">
                <Plus />
                Agregar equipo
              </Button>
            )}
          </div>
        </div>

        {!error && (equipos.length > 0 || isLoading) && (
          <div className="grid grid-cols-3 gap-3">
            <StatChip
              icon={<CheckCircle2 className="size-4" />}
              label="Operativos"
              loading={isLoading}
              tone="success"
              value={summary.operativos}
            />
            <StatChip
              icon={<Wrench className="size-4" />}
              label="Con alerta"
              loading={isLoading}
              tone="warning"
              value={summary.conAlerta}
            />
            <StatChip
              icon={<PowerOff className="size-4" />}
              label="Inactivos"
              loading={isLoading}
              tone="muted"
              value={summary.inactivos}
            />
          </div>
        )}

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Equipos registrados</CardTitle>
              <p className="text-muted-foreground text-xs">
                {filteredEquipos.length} resultado
                {filteredEquipos.length === 1 ? "" : "s"} disponibles.
                {equipos.length >= EQUIPOS_PAGE_LIMIT && (
                  <span className="text-warning-foreground">
                    {" "}
                    Mostrando los primeros {EQUIPOS_PAGE_LIMIT}; refina la
                    búsqueda para ver el resto.
                  </span>
                )}
              </p>
            </div>
            {isAdmin && (
              <label className="flex cursor-pointer items-center gap-2 text-muted-foreground text-xs">
                <Switch
                  checked={includeInactive}
                  onCheckedChange={setIncludeInactive}
                />
                Incluir inactivos
              </label>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && <TableSkeleton cols={colSpan} />}

            {!isLoading && error && (
              <div className="p-5">
                <EmptyState
                  icon="wrench"
                  message="No se pudieron cargar los equipos desde la API. Revisa la conexión o el endpoint GET /equipos."
                  title="Error al cargar equipos"
                />
              </div>
            )}

            {!isLoading && !error && equipos.length === 0 && (
              <div className="p-5">
                <EmptyState
                  icon="wrench"
                  message={
                    debouncedQuery
                      ? "Ajusta la búsqueda para encontrar otro equipo."
                      : "Crea el primer equipo para iniciar el registro de la flota operacional."
                  }
                  title={debouncedQuery ? "Sin resultados" : "No hay equipos registrados"}
                />
                {isAdmin && !debouncedQuery && (
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
              <>
                {/* Vista de tabla (desktop) */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                        <th className="px-5 py-3 font-semibold">Código</th>
                        <th className="px-5 py-3 font-semibold">Nombre</th>
                        <th className="px-5 py-3 font-semibold">Marca</th>
                        <th className="px-5 py-3 font-semibold">Modelo</th>
                        <th className="px-5 py-3 font-semibold">Ubicación</th>
                        <th className="px-5 py-3 font-semibold">Estado op.</th>
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
                      {filteredEquipos.map((equipo) => {
                        const inactive = equipo.activo === false;
                        return (
                          <tr
                            className="border-border/60 border-b transition-colors last:border-0 hover:bg-accent/40"
                            key={equipo.id}
                            onFocus={() => prefetchEquipo(equipo.id)}
                            onMouseEnter={() => prefetchEquipo(equipo.id)}
                          >
                            <td className="whitespace-nowrap px-5 py-3.5 font-mono font-semibold text-xs">
                              <Link
                                className="text-brand-primary hover:underline focus-visible:underline focus-visible:outline-none"
                                href={`/equipos/${equipo.id}`}
                              >
                                {equipo.codigo}
                              </Link>
                            </td>
                            <td className="px-5 py-3.5 font-medium">
                              <Link
                                className="hover:underline focus-visible:underline focus-visible:outline-none"
                                href={`/equipos/${equipo.id}`}
                              >
                                {equipo.nombre}
                              </Link>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground text-xs">
                              {equipo.marca ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground text-xs">
                              {equipo.modelo ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5">
                              {equipo.ubicacion ? (
                                <Badge variant="secondary">
                                  {equipo.ubicacion}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5">
                              <EstadoOperativoBadge
                                estado={equipo.estadoOperativo}
                              />
                            </td>
                            {includeInactive && (
                              <td className="whitespace-nowrap px-5 py-3.5">
                                <Badge variant={inactive ? "outline" : "success"}>
                                  {inactive ? "Inactivo" : "Activo"}
                                </Badge>
                              </td>
                            )}
                            {isAdmin && (
                              <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                <div className="flex justify-end gap-1">
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <Button
                                          aria-label={`Editar ${equipo.codigo}`}
                                          onClick={() => openEdit(equipo)}
                                          size="icon-sm"
                                          variant="ghost"
                                        >
                                          <Pencil />
                                        </Button>
                                      }
                                    />
                                    <TooltipPopup>Editar</TooltipPopup>
                                  </Tooltip>
                                  {inactive ? (
                                    <Tooltip>
                                      <TooltipTrigger
                                        render={
                                          <Button
                                            aria-label={`Reactivar ${equipo.codigo}`}
                                            loading={
                                              reactivar.isPending &&
                                              reactivarId === equipo.id
                                            }
                                            onClick={() => handleReactivar(equipo)}
                                            size="icon-sm"
                                            variant="outline"
                                          >
                                            <Power />
                                          </Button>
                                        }
                                      />
                                      <TooltipPopup>Reactivar</TooltipPopup>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip>
                                      <TooltipTrigger
                                        render={
                                          <Button
                                            aria-label={`Desactivar ${equipo.codigo}`}
                                            onClick={() => setToDeactivate(equipo)}
                                            size="icon-sm"
                                            variant="destructive-outline"
                                          >
                                            <PowerOff />
                                          </Button>
                                        }
                                      />
                                      <TooltipPopup>Desactivar</TooltipPopup>
                                    </Tooltip>
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

                {/* Vista de tarjetas (móvil) */}
                <div className="divide-y divide-border/60 md:hidden">
                  {filteredEquipos.map((equipo) => {
                    const inactive = equipo.activo === false;
                    return (
                      <div
                        className="p-4"
                        key={equipo.id}
                        onFocus={() => prefetchEquipo(equipo.id)}
                        onMouseEnter={() => prefetchEquipo(equipo.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            className="min-w-0"
                            href={`/equipos/${equipo.id}`}
                          >
                            <p className="font-mono font-semibold text-brand-primary text-xs">
                              {equipo.codigo}
                            </p>
                            <p className="mt-0.5 truncate font-medium text-sm">
                              {equipo.nombre}
                            </p>
                          </Link>
                          <EstadoOperativoBadge estado={equipo.estadoOperativo} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
                          {equipo.marca && <span>{equipo.marca}</span>}
                          {equipo.modelo && <span>· {equipo.modelo}</span>}
                          {equipo.ubicacion && (
                            <Badge variant="secondary">{equipo.ubicacion}</Badge>
                          )}
                          {inactive && <Badge variant="outline">Inactivo</Badge>}
                        </div>
                        {isAdmin && (
                          <div className="mt-3 flex gap-2">
                            <Button
                              className="flex-1"
                              onClick={() => openEdit(equipo)}
                              size="sm"
                              variant="outline"
                            >
                              <Pencil />
                              Editar
                            </Button>
                            {inactive ? (
                              <Button
                                className="flex-1"
                                loading={
                                  reactivar.isPending &&
                                  reactivarId === equipo.id
                                }
                                onClick={() => handleReactivar(equipo)}
                                size="sm"
                                variant="outline"
                              >
                                <Power />
                                Reactivar
                              </Button>
                            ) : (
                              <Button
                                className="flex-1"
                                onClick={() => setToDeactivate(equipo)}
                                size="sm"
                                variant="destructive-outline"
                              >
                                <PowerOff />
                                Desactivar
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
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
    </TooltipProvider>
  );
}

function StatChip({
  icon,
  label,
  value,
  tone,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "success" | "warning" | "muted";
  loading?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success-foreground ring-success/20"
      : tone === "warning"
        ? "bg-warning/10 text-warning-foreground ring-warning/20"
        : "bg-muted text-muted-foreground ring-border";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${toneClass}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          {loading ? (
            <Skeleton className="h-6 w-8" />
          ) : (
            <p className="font-semibold text-xl tabular-nums leading-tight">
              {value}
            </p>
          )}
          <p className="truncate text-muted-foreground text-xs">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
