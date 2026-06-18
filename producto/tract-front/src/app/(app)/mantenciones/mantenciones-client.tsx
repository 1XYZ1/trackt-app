"use client";

import { useMemo, useState } from "react";
import { CalendarDays, List, Loader2, Pencil, Plus, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/core";
import {
  CalendarioMes,
  GenerarOtDialog,
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
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
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

export function MantencionesClient() {
  const today = new Date();
  const [cursor, setCursor] = useState({
    month: today.getMonth(),
    year: today.getFullYear(),
  });
  const [tab, setTab] = useState("calendario");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Programacion | null>(null);
  const [generarTarget, setGenerarTarget] = useState<Programacion | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Programacion | null>(null);

  const isAdmin = useHasRole("admin");
  const isJefe = useHasRole("jefe_taller");
  const canManage = isAdmin || isJefe;

  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const desde = `${cursor.year}-${pad(cursor.month + 1)}-01T00:00:00.000Z`;
  const hasta = `${cursor.year}-${pad(cursor.month + 1)}-${pad(daysInMonth)}T23:59:59.999Z`;

  const { data: eventos = [] } = useCalendario(desde, hasta);
  const { data: programaciones = [], error, isLoading } = useProgramaciones();
  const { data: mecanicos = [] } = useCargaMecanicos();
  const cancelar = useCancelarProgramacion();

  const nombrePorId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of mecanicos) map.set(m.mecanicoId, m.nombre ?? m.email ?? m.mecanicoId);
    return map;
  }, [mecanicos]);

  const prevMonth = () =>
    setCursor((c) =>
      c.month === 0 ? { month: 11, year: c.year - 1 } : { month: c.month - 1, year: c.year },
    );
  const nextMonth = () =>
    setCursor((c) =>
      c.month === 11 ? { month: 0, year: c.year + 1 } : { month: c.month + 1, year: c.year },
    );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (p: Programacion) => {
    if (p.estado !== "PROGRAMADA") {
      toast.info("Solo las programaciones en estado Programada se pueden editar");
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
        err instanceof Error ? err.message : "No se pudo cancelar la programación",
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
            <CalendarDays className="size-3.5" />
            Mantenimiento preventivo
          </div>
          <h1 className="font-semibold text-2xl tracking-tight">Mantenciones</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
            Programaciones de mantenimiento y generación de órdenes de trabajo.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} size="sm">
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
          <Card className="rounded-lg border-border/70">
            <CardContent className="p-4">
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
          <Card className="rounded-lg border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Todas las programaciones</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading && (
                <div className="flex items-center gap-2 px-5 py-16 text-muted-foreground text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando programaciones...
                </div>
              )}

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
                </div>
              )}

              {!isLoading && !error && programaciones.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                        <th className="px-5 py-3 font-semibold">Título</th>
                        <th className="px-5 py-3 font-semibold">Equipo</th>
                        <th className="px-5 py-3 font-semibold">Fecha</th>
                        <th className="px-5 py-3 font-semibold">Responsable</th>
                        <th className="px-5 py-3 font-semibold">Estado</th>
                        <th className="px-5 py-3 font-semibold">Prioridad</th>
                        {canManage && (
                          <th className="px-5 py-3 text-right font-semibold">Acciones</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {programaciones.map((p) => {
                        const editable = p.estado === "PROGRAMADA";
                        return (
                          <tr
                            className="border-border/60 border-b last:border-0 hover:bg-secondary/25"
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
                            <td className="whitespace-nowrap px-5 py-3 text-xs">
                              {p.equipo.codigo}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-muted-foreground text-xs">
                              {fmtFecha(p.fechaProgramada)}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-muted-foreground text-xs">
                              {p.responsableId
                                ? nombrePorId.get(p.responsableId) ?? "—"
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
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    disabled={!editable}
                                    onClick={() => setGenerarTarget(p)}
                                    size="sm"
                                    variant="outline"
                                  >
                                    <Zap />
                                    Generar OT
                                  </Button>
                                  <Button
                                    disabled={!editable}
                                    onClick={() => openEdit(p)}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    <Pencil />
                                  </Button>
                                  <Button
                                    disabled={!editable}
                                    onClick={() => setCancelTarget(p)}
                                    size="sm"
                                    variant="destructive-outline"
                                  >
                                    <XCircle />
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
        </TabsPanel>
      </Tabs>

      {canManage && (
        <ProgramacionFormSheet
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setEditing(null);
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
  );
}
