"use client";

import { useMemo, useState } from "react";
import { CalendarDays, List, Pencil, Plus, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/core";
import {
  CalendarioMes,
  GenerarOtDialog,
  type ProgramacionFormDefaults,
  PrioridadBadge,
  ProgramacionEstadoBadge,
  ProgramacionFormSheet,
} from "@/components/programaciones";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipPopup,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHasRole } from "@/contexts/auth-context";
import { useCargaMecanicos } from "@/hooks/use-tickets";
import {
  useCalendario,
  useCancelarProgramacion,
  useProgramaciones,
} from "@/hooks/use-programaciones";
import type { Programacion } from "@/lib/api/programaciones";

const pad = (n: number) => String(n).padStart(2, "0");

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: rows }).map((_, idx) => (
        <div className="flex items-center gap-4 px-5 py-3" key={idx}>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="ml-auto h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export type MantencionesClientProps = {
  // Preselección al llegar desde la ficha del equipo ("Programar"): abre el
  // formulario de alta con equipo/plantilla ya elegidos.
  initialDefaults?: ProgramacionFormDefaults | null;
};

export function MantencionesClient({
  initialDefaults,
}: MantencionesClientProps = {}) {
  const today = new Date();
  const [cursor, setCursor] = useState({
    month: today.getMonth(),
    year: today.getFullYear(),
  });
  const [tab, setTab] = useState("calendario");
  const isAdmin = useHasRole("admin");
  const isJefe = useHasRole("jefe_taller");
  const canManage = isAdmin || isJefe;

  // Deep-link desde la ficha del equipo ("Programar"): abrir el alta
  // preseleccionada en el primer render mediante estado inicial perezoso
  // (sin efecto, para no disparar renders en cascada).
  const hasInitialDefaults = Boolean(
    initialDefaults?.equipoId || initialDefaults?.plantillaId,
  );
  const abrirAltaInicial = canManage && hasInitialDefaults;

  const [formOpen, setFormOpen] = useState(abrirAltaInicial);
  const [editing, setEditing] = useState<Programacion | null>(null);
  // Defaults activos solo para el alta abierta desde el deep-link; se limpian
  // al cerrar para no contaminar un alta manual posterior.
  const [formDefaults, setFormDefaults] =
    useState<ProgramacionFormDefaults | null>(
      abrirAltaInicial ? (initialDefaults ?? null) : null,
    );
  const [generarTarget, setGenerarTarget] = useState<Programacion | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Programacion | null>(null);

  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const desde = `${cursor.year}-${pad(cursor.month + 1)}-01T00:00:00.000Z`;
  const hasta = `${cursor.year}-${pad(cursor.month + 1)}-${pad(daysInMonth)}T23:59:59.999Z`;

  const { data: eventos = [] } = useCalendario(desde, hasta);
  const { data: programaciones = [], error, isLoading } = useProgramaciones();
  const { data: mecanicos = [] } = useCargaMecanicos();
  const cancelar = useCancelarProgramacion();

  const nombrePorId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of mecanicos)
      map.set(m.mecanicoId, m.nombre ?? m.email ?? m.mecanicoId);
    return map;
  }, [mecanicos]);

  const prevMonth = () =>
    setCursor((c) =>
      c.month === 0
        ? { month: 11, year: c.year - 1 }
        : { month: c.month - 1, year: c.year },
    );
  const nextMonth = () =>
    setCursor((c) =>
      c.month === 11
        ? { month: 0, year: c.year + 1 }
        : { month: c.month + 1, year: c.year },
    );

  const openCreate = () => {
    setEditing(null);
    setFormDefaults(null);
    setFormOpen(true);
  };
  const openEdit = (p: Programacion) => {
    if (p.estado !== "PROGRAMADA") {
      toast.info(
        "Solo las programaciones en estado Programada se pueden editar",
      );
      return;
    }
    setEditing(p);
    setFormOpen(true);
  };
  const handleSelectEvent = (eventId: string) => {
    const p = programaciones.find((x) => x.id === eventId);
    if (p) openEdit(p);
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelar.mutateAsync(cancelTarget.id);
      toast.success("Programación cancelada");
      setCancelTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudo cancelar la programación",
      );
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
              <CalendarDays className="size-3.5" />
              Mantenimiento preventivo
            </div>
            <h1 className="font-semibold text-2xl tracking-tight">
              Mantenciones
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
              Programaciones de mantenimiento y generación de órdenes de trabajo.
            </p>
          </div>
          {canManage && (
            <Button className="shrink-0" onClick={openCreate} size="sm">
              <Plus />
              Nueva programación
            </Button>
          )}
        </div>

        <Tabs onValueChange={(v) => setTab(v as string)} value={tab}>
          <TabsList>
            <TabsTab value="calendario">
              <CalendarDays />
              Calendario
            </TabsTab>
            <TabsTab value="lista">
              <List />
              Lista
            </TabsTab>
          </TabsList>

          <TabsPanel className="mt-4" value="calendario">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <CalendarioMes
                  events={eventos}
                  month={cursor.month}
                  onNext={nextMonth}
                  onPrev={prevMonth}
                  onSelectEvent={handleSelectEvent}
                  year={cursor.year}
                />
              </CardContent>
            </Card>
          </TabsPanel>

          <TabsPanel className="mt-4" value="lista">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Todas las programaciones
                </CardTitle>
                <p className="text-muted-foreground text-xs">
                  {programaciones.length} programación
                  {programaciones.length === 1 ? "" : "es"} registrada
                  {programaciones.length === 1 ? "" : "s"}.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading && <TableSkeleton />}

                {!isLoading && error && (
                  <div className="p-5">
                    <EmptyState
                      icon="wrench"
                      message="No se pudieron cargar las programaciones."
                      title="Error al cargar"
                    />
                  </div>
                )}

                {!isLoading && !error && programaciones.length === 0 && (
                  <div className="p-5">
                    <EmptyState
                      icon="wrench"
                      message="Crea la primera programación de mantenimiento."
                      title="Sin programaciones"
                    />
                    {canManage && (
                      <div className="mt-4 flex justify-center">
                        <Button onClick={openCreate}>
                          <Plus />
                          Nueva programación
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {!isLoading && !error && programaciones.length > 0 && (
                  <>
                    {/* Vista de tabla (desktop) */}
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                            <th className="px-5 py-3 font-semibold">Título</th>
                            <th className="px-5 py-3 font-semibold">Equipo</th>
                            <th className="px-5 py-3 font-semibold">Fecha</th>
                            <th className="px-5 py-3 font-semibold">
                              Responsable
                            </th>
                            <th className="px-5 py-3 font-semibold">Estado</th>
                            <th className="px-5 py-3 font-semibold">Prioridad</th>
                            {canManage && (
                              <th className="px-5 py-3 text-right font-semibold">
                                Acciones
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {programaciones.map((p) => {
                            const editable = p.estado === "PROGRAMADA";
                            return (
                              <tr
                                className="border-border/60 border-b transition-colors last:border-0 hover:bg-accent/40"
                                key={p.id}
                              >
                                <td className="px-5 py-3 font-medium">
                                  {p.titulo}
                                  {p.plantilla && (
                                    <span className="block text-muted-foreground text-xs">
                                      {p.plantilla.nombre}
                                    </span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-5 py-3 font-mono text-xs">
                                  {p.equipo.codigo}
                                </td>
                                <td className="whitespace-nowrap px-5 py-3 text-muted-foreground text-xs">
                                  {fmtFecha(p.fechaProgramada)}
                                </td>
                                <td className="whitespace-nowrap px-5 py-3 text-muted-foreground text-xs">
                                  {p.responsableId
                                    ? (nombrePorId.get(p.responsableId) ?? "—")
                                    : "—"}
                                </td>
                                <td className="px-5 py-3">
                                  <ProgramacionEstadoBadge estado={p.estado} />
                                </td>
                                <td className="px-5 py-3">
                                  <PrioridadBadge prioridad={p.prioridad} />
                                </td>
                                {canManage && (
                                  <td className="whitespace-nowrap px-5 py-3 text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button
                                        disabled={!editable}
                                        onClick={() => setGenerarTarget(p)}
                                        size="sm"
                                        variant="outline"
                                      >
                                        <Zap />
                                        Generar OT
                                      </Button>
                                      <Tooltip>
                                        <TooltipTrigger
                                          render={
                                            <Button
                                              aria-label="Editar programación"
                                              disabled={!editable}
                                              onClick={() => openEdit(p)}
                                              size="icon-sm"
                                              variant="ghost"
                                            >
                                              <Pencil />
                                            </Button>
                                          }
                                        />
                                        <TooltipPopup>Editar</TooltipPopup>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger
                                          render={
                                            <Button
                                              aria-label="Cancelar programación"
                                              disabled={!editable}
                                              onClick={() => setCancelTarget(p)}
                                              size="icon-sm"
                                              variant="destructive-outline"
                                            >
                                              <XCircle />
                                            </Button>
                                          }
                                        />
                                        <TooltipPopup>Cancelar</TooltipPopup>
                                      </Tooltip>
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
                      {programaciones.map((p) => {
                        const editable = p.estado === "PROGRAMADA";
                        return (
                          <div className="p-4" key={p.id}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium text-sm">{p.titulo}</p>
                                <p className="text-muted-foreground text-xs">
                                  {p.equipo.codigo} · {fmtFecha(p.fechaProgramada)}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <ProgramacionEstadoBadge estado={p.estado} />
                                <PrioridadBadge prioridad={p.prioridad} />
                              </div>
                            </div>
                            {canManage && editable && (
                              <div className="mt-3 flex gap-2">
                                <Button
                                  className="flex-1"
                                  onClick={() => setGenerarTarget(p)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Zap />
                                  Generar OT
                                </Button>
                                <Button
                                  aria-label="Editar programación"
                                  onClick={() => openEdit(p)}
                                  size="icon-sm"
                                  variant="ghost"
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  aria-label="Cancelar programación"
                                  onClick={() => setCancelTarget(p)}
                                  size="icon-sm"
                                  variant="destructive-outline"
                                >
                                  <XCircle />
                                </Button>
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
          </TabsPanel>
        </Tabs>

        {canManage && (
          <ProgramacionFormSheet
            defaults={formDefaults}
            onOpenChange={(open) => {
              setFormOpen(open);
              if (!open) {
                setEditing(null);
                setFormDefaults(null);
              }
            }}
            open={formOpen}
            programacion={editing}
          />
        )}

        {generarTarget && (
          <GenerarOtDialog
            onOpenChange={(open) => {
              if (!open) setGenerarTarget(null);
            }}
            open={Boolean(generarTarget)}
            programacion={generarTarget}
          />
        )}

        <AlertDialog
          onOpenChange={(open) => {
            if (!open) setCancelTarget(null);
          }}
          open={Boolean(cancelTarget)}
        >
          <AlertDialogPopup>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar programación</AlertDialogTitle>
              <AlertDialogDescription>
                {cancelTarget
                  ? `Se cancelará "${cancelTarget.titulo}". Esta acción no se puede deshacer.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="outline" />}>
                Volver
              </AlertDialogClose>
              <Button
                loading={cancelar.isPending}
                onClick={handleConfirmCancel}
                variant="destructive"
              >
                Cancelar programación
              </Button>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
