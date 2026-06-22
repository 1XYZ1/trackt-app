"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  Package,
  Pencil,
  QrCode,
  Ticket,
  TicketCheck,
  Wrench,
} from "lucide-react";
import { DetailBreadcrumb, EmptyState } from "@/components/core";
import {
  EquipoFormSheet,
  EquipoHistorial,
  EquipoPlantillas,
  EquipoProgramaciones,
  EquipoRepuestos,
  EstadoOperativoBadge,
  QrDialog,
} from "@/components/equipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { useHasRole } from "@/contexts/auth-context";
import { useEquipo, useEquipoResumen } from "@/hooks/use-equipos";
import type { EquipoAlerta } from "@/lib/api/equipos";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Dato({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="font-medium text-sm">{value || "—"}</p>
    </div>
  );
}

const ESTADISTICA_ICONS = {
  ordenesAbiertas: ClipboardList,
  ordenesCerradas: ClipboardCheck,
  ticketsActivos: Ticket,
  ticketsCerrados: TicketCheck,
  reservasActivas: Boxes,
  repuestosConsumidos: Package,
} as const;

function Estadistica({
  icon: Icon,
  label,
  value,
}: {
  icon: (typeof ESTADISTICA_ICONS)[keyof typeof ESTADISTICA_ICONS];
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-secondary/15 p-3 transition-colors hover:bg-secondary/25">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-2xl tabular-nums">{value}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-0.5 text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

const ALERTA_STYLE: Record<EquipoAlerta["tipo"], string> = {
  EN_MANTENIMIENTO: "border-warning/40 bg-warning/8 text-warning-foreground",
  EQUIPO_INACTIVO: "border-border bg-secondary/30 text-foreground",
  FUERA_DE_SERVICIO:
    "border-destructive/40 bg-destructive/8 text-destructive-foreground",
  OT_PRIORIDAD_ALTA:
    "border-destructive/40 bg-destructive/8 text-destructive-foreground",
};

export type EquipoDetalleClientProps = {
  id: string;
};

export function EquipoDetalleClient({ id }: EquipoDetalleClientProps) {
  const [tab, setTab] = useState("resumen");
  const [editOpen, setEditOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const isAdmin = useHasRole("admin");

  const equipoQuery = useEquipo(id);
  const resumenQuery = useEquipoResumen(id);

  const equipo = equipoQuery.data;
  const resumen = resumenQuery.data;

  if (equipoQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-32" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-10 w-full max-w-md rounded-lg" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (equipoQuery.error || !equipo) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          className="inline-flex w-fit items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
          href="/equipos"
        >
          <ArrowLeft className="size-4" />
          Volver a equipos
        </Link>
        <Card>
          <CardContent className="p-5">
            <EmptyState
              icon="wrench"
              message="No se pudo cargar el equipo. Verifica el identificador o la conexión con la API."
              title="Equipo no disponible"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <DetailBreadcrumb
          current={equipo.codigo}
          parentHref="/equipos"
          parentLabel="Equipos"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-secondary px-2 py-0.5 font-mono font-semibold text-xs">
                {equipo.codigo}
              </span>
              <EstadoOperativoBadge estado={equipo.estadoOperativo} />
              {equipo.activo === false && (
                <Badge variant="outline">Inactivo</Badge>
              )}
            </div>
            <h1 className="font-semibold text-2xl tracking-tight">
              {equipo.nombre}
            </h1>
            {(equipo.marca || equipo.modelo) && (
              <p className="text-muted-foreground text-sm">
                {[equipo.marca, equipo.modelo].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={() => setQrOpen(true)} size="sm" variant="outline">
              <QrCode />
              QR
            </Button>
            {isAdmin && (
              <Button
                onClick={() => setEditOpen(true)}
                size="sm"
                variant="outline"
              >
                <Pencil />
                Editar
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs onValueChange={(value) => setTab(value as string)} value={tab}>
        <TabsList className="w-full max-w-full justify-start overflow-x-auto">
          <TabsTab value="resumen">Resumen</TabsTab>
          <TabsTab value="historial">Historial</TabsTab>
          <TabsTab value="repuestos">Repuestos</TabsTab>
          <TabsTab value="plantillas">Plantillas</TabsTab>
          <TabsTab value="programaciones">Programaciones</TabsTab>
        </TabsList>

        <TabsPanel className="mt-4" value="resumen">
          <div className="flex flex-col gap-5">
            {resumen && resumen.alertas.length > 0 && (
              <div className="flex flex-col gap-2">
                {resumen.alertas.map((alerta, idx) => (
                  <div
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 font-medium text-sm ${ALERTA_STYLE[alerta.tipo]}`}
                    key={`${alerta.tipo}-${idx}`}
                  >
                    <AlertTriangle className="size-4 shrink-0" />
                    {alerta.mensaje}
                  </div>
                ))}
              </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Datos del equipo</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                <Dato label="Tipo" value={equipo.tipo} />
                <Dato label="Marca" value={equipo.marca} />
                <Dato label="Modelo" value={equipo.modelo} />
                <Dato label="N° de serie" value={equipo.numeroSerie} />
                <Dato label="Ubicación" value={equipo.ubicacion} />
                <Dato
                  label="Instalación"
                  value={fmtDate(equipo.fechaInstalacion)}
                />
                <Dato label="Compra" value={fmtDate(equipo.fechaCompra)} />
              </CardContent>
            </Card>

            {resumenQuery.isLoading && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton className="h-20 rounded-lg" key={idx} />
                ))}
              </div>
            )}

            {resumen && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <Estadistica
                    icon={ESTADISTICA_ICONS.ordenesAbiertas}
                    label="OT abiertas"
                    value={resumen.estadisticas.ordenesAbiertas}
                  />
                  <Estadistica
                    icon={ESTADISTICA_ICONS.ordenesCerradas}
                    label="OT cerradas"
                    value={resumen.estadisticas.ordenesCerradas}
                  />
                  <Estadistica
                    icon={ESTADISTICA_ICONS.ticketsActivos}
                    label="Tickets activos"
                    value={resumen.estadisticas.ticketsActivos}
                  />
                  <Estadistica
                    icon={ESTADISTICA_ICONS.ticketsCerrados}
                    label="Tickets cerrados"
                    value={resumen.estadisticas.ticketsCerrados}
                  />
                  <Estadistica
                    icon={ESTADISTICA_ICONS.reservasActivas}
                    label="Reservas activas"
                    value={resumen.estadisticas.reservasActivas}
                  />
                  <Estadistica
                    icon={ESTADISTICA_ICONS.repuestosConsumidos}
                    label="Repuestos consumidos"
                    value={resumen.estadisticas.repuestosConsumidos}
                  />
                </div>

                <div className="grid gap-5 lg:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <ClipboardList className="size-4 text-brand-primary" />
                        Últimas OT
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {resumen.ultimasOrdenes.length === 0 && (
                        <p className="text-muted-foreground text-xs">
                          Sin órdenes registradas.
                        </p>
                      )}
                      {resumen.ultimasOrdenes.map((ot) => (
                        <Link
                          className="block rounded-md border border-border/60 p-2 text-sm transition-colors hover:border-brand-primary/40 hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
                          href={`/ordenes/${ot.id}`}
                          key={ot.id}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs">
                              {ot.codigo}
                            </span>
                            <Badge variant="secondary">{ot.estado}</Badge>
                          </span>
                          <span className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
                            {ot.descripcion}
                          </span>
                        </Link>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Ticket className="size-4 text-brand-primary" />
                        Últimos tickets
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {resumen.ultimosTickets.length === 0 && (
                        <p className="text-muted-foreground text-xs">
                          Sin tickets registrados.
                        </p>
                      )}
                      {resumen.ultimosTickets.map((t) => (
                        <Link
                          className="block rounded-md border border-border/60 p-2 text-sm transition-colors hover:border-brand-primary/40 hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
                          href={`/tickets/${t.id}`}
                          key={t.id}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs">{t.codigo}</span>
                            <Badge variant="secondary">{t.estado}</Badge>
                          </span>
                          <span className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
                            {t.titulo}
                          </span>
                        </Link>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Wrench className="size-4 text-brand-primary" />
                        Próximas programaciones
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {resumen.proximasProgramaciones.length === 0 && (
                        <p className="text-muted-foreground text-xs">
                          Sin programaciones próximas.
                        </p>
                      )}
                      {resumen.proximasProgramaciones.map((p) => (
                        <div
                          className="rounded-md border border-border/60 p-2 text-sm"
                          key={p.id}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-medium text-xs">
                              {p.titulo}
                            </span>
                            <Badge variant="secondary">{p.estado}</Badge>
                          </span>
                          <span className="mt-0.5 block text-muted-foreground text-xs">
                            {fmtDate(p.fechaProgramada)}
                            {p.plantilla ? ` · ${p.plantilla.nombre}` : ""}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {!resumen && !resumenQuery.isLoading && (
              <Card className="border-warning/40 bg-warning/5">
                <CardContent className="flex items-center gap-2 p-4 text-sm text-warning-foreground">
                  <AlertTriangle className="size-4 shrink-0" />
                  No se pudo cargar el resumen operativo del equipo.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsPanel>

        <TabsPanel className="mt-4" value="historial">
          <EquipoHistorial equipoId={id} />
        </TabsPanel>
        <TabsPanel className="mt-4" value="repuestos">
          <EquipoRepuestos equipoId={id} />
        </TabsPanel>
        <TabsPanel className="mt-4" value="plantillas">
          <EquipoPlantillas equipoId={id} />
        </TabsPanel>
        <TabsPanel className="mt-4" value="programaciones">
          <EquipoProgramaciones equipoId={id} />
        </TabsPanel>
      </Tabs>

      {isAdmin && (
        <EquipoFormSheet
          equipo={equipo}
          onOpenChange={setEditOpen}
          open={editOpen}
        />
      )}
      <QrDialog
        canManage={isAdmin}
        equipo={equipo}
        onOpenChange={setQrOpen}
        open={qrOpen}
      />
    </div>
  );
}
