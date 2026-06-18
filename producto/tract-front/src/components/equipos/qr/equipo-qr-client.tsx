"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  MapPin,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/core";
import type { TicketEstado } from "@/components/core";
import { useRole } from "@/contexts/auth-context";
import {
  useCambiarEstadoOperativo,
  useEquipoByQr,
  useEquipoResumen,
} from "@/hooks/use-equipos";
import {
  ESTADO_OPERATIVO_LABEL,
  EstadoOperativoBadge,
} from "@/components/equipos/estado-operativo-badge";
import type { EquipoEstadoOperativo } from "@/lib/api/equipos";
import { cn } from "@/lib/utils";
import { ReportarFallaDialog } from "./reportar-falla-dialog";
import { TicketQrSheet } from "./ticket-qr-sheet";

const ESTADOS: EquipoEstadoOperativo[] = [
  "OPERATIVO",
  "EN_MANTENIMIENTO",
  "FUERA_DE_SERVICIO",
];

const TICKET_TERMINALES = ["CERRADO", "CANCELADO"];

// Ficha mobile del equipo a la que llega el QR. Contenido y acciones según rol.
export function EquipoQrClient({ token }: { token: string }) {
  const role = useRole();
  const {
    data: equipo,
    error: equipoError,
    isLoading: equipoLoading,
  } = useEquipoByQr(token);
  const equipoId = equipo?.id ?? "";
  const { data: resumen, isLoading: resumenLoading } =
    useEquipoResumen(equipoId);
  const cambiarEstado = useCambiarEstadoOperativo();

  const [fallaOpen, setFallaOpen] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  if (equipoLoading) {
    return <EquipoQrSkeleton />;
  }

  if (equipoError || !equipo) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="font-semibold text-base">Equipo no encontrado</h1>
        <p className="mt-1.5 max-w-xs text-pretty text-muted-foreground text-sm leading-relaxed">
          No se encontró el equipo de este código QR, o no pertenece a tu
          organización.
        </p>
      </div>
    );
  }

  const estadoActual = resumen?.equipo.estadoOperativo ?? equipo.estadoOperativo;
  const ticketsActivos = (resumen?.ultimosTickets ?? []).filter(
    (t) => !TICKET_TERMINALES.includes(t.estado),
  );
  // Cualquier rol puede levantar una falla del equipo en terreno.
  const canReportar =
    role === "admin" || role === "jefe_taller" || role === "mechanic";

  const handleCambiarEstado = (estado: EquipoEstadoOperativo) => {
    if (estado === estadoActual) return;
    cambiarEstado.mutate(
      { estadoOperativo: estado, id: equipo.id },
      {
        onSuccess: () =>
          toast.success(`Estado: ${ESTADO_OPERATIVO_LABEL[estado]}`),
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "No se pudo cambiar el estado",
          ),
      },
    );
  };

  const modelo =
    [equipo.tipo, equipo.marca, equipo.modelo].filter(Boolean).join(" · ") ||
    "Sin datos de modelo";

  return (
    <div className="space-y-5 pb-4">
      {/* Cabecera */}
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-muted-foreground text-xs">
            {equipo.codigo}
          </span>
          <EstadoOperativoBadge estado={estadoActual} />
        </div>
        <h1 className="text-balance font-semibold text-2xl leading-tight tracking-tight">
          {equipo.nombre}
        </h1>
        <div className="space-y-1 text-muted-foreground text-sm">
          <p>{modelo}</p>
          {equipo.ubicacion && (
            <p className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              {equipo.ubicacion}
            </p>
          )}
        </div>
      </header>

      {/* Alertas */}
      {resumen && resumen.alertas.length > 0 && (
        <div className="space-y-2">
          {resumen.alertas.map((a) => (
            <div
              className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/8 p-3 text-sm dark:bg-warning/12"
              key={a.tipo}
            >
              <AlertTriangle className="mt-px size-4 shrink-0 text-warning-foreground" />
              <span className="text-warning-foreground leading-snug">
                {a.mensaje}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard
          icon={<ClipboardList className="size-4" />}
          label="OTs abiertas"
          loading={resumenLoading}
          value={resumen?.estadisticas.ordenesAbiertas}
        />
        <StatCard
          icon={<Wrench className="size-4" />}
          label="Tickets activos"
          loading={resumenLoading}
          value={resumen?.estadisticas.ticketsActivos}
        />
        <StatCard
          icon={<CalendarClock className="size-4" />}
          label="Mantenciones"
          loading={resumenLoading}
          value={resumen?.proximasProgramaciones.length}
        />
      </div>

      {/* Estado operativo */}
      <section className="space-y-2.5">
        <SectionLabel>Estado operativo</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {ESTADOS.map((e) => {
            const active = e === estadoActual;
            return (
              <Button
                aria-pressed={active}
                className={cn(
                  "h-auto min-h-12 whitespace-normal px-2 py-2 text-xs leading-tight",
                  active && "ring-2 ring-ring/60 ring-offset-1",
                )}
                disabled={cambiarEstado.isPending}
                key={e}
                onClick={() => handleCambiarEstado(e)}
                variant={active ? "default" : "outline"}
              >
                {ESTADO_OPERATIVO_LABEL[e]}
              </Button>
            );
          })}
        </div>
      </section>

      {/* Reportar falla */}
      {canReportar && (
        <Button
          className="h-12 w-full text-sm"
          onClick={() => setFallaOpen(true)}
          variant="destructive-outline"
        >
          <AlertTriangle />
          Reportar falla
        </Button>
      )}

      {/* Tickets activos */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Tickets activos</SectionLabel>
          {!resumenLoading && ticketsActivos.length > 0 && (
            <span className="font-medium text-muted-foreground text-xs tabular-nums">
              {ticketsActivos.length}
            </span>
          )}
        </div>
        {resumenLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-[68px] w-full rounded-xl" />
            <Skeleton className="h-[68px] w-full rounded-xl" />
          </div>
        ) : ticketsActivos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-1 px-4 py-8 text-center">
              <Wrench className="size-5 text-muted-foreground/70" />
              <p className="text-muted-foreground text-sm">
                Sin tickets activos para este equipo.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {ticketsActivos.map((t) => (
              <button
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                key={t.id}
                onClick={() => setTicketId(t.id)}
                type="button"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="truncate font-medium text-sm leading-tight">
                    {t.titulo}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground text-xs">
                      {t.codigo}
                    </span>
                    <StatusBadge
                      estado={t.estado as TicketEstado}
                      showIcon={false}
                    />
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Próximas mantenciones */}
      {resumen && resumen.proximasProgramaciones.length > 0 && (
        <section className="space-y-2.5">
          <SectionLabel>Próximas mantenciones</SectionLabel>
          <div className="space-y-2">
            {resumen.proximasProgramaciones.map((p) => (
              <div
                className="flex items-center gap-3 rounded-xl border bg-card p-3.5"
                key={p.id}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <CalendarClock className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm leading-tight">
                    {p.titulo}
                  </p>
                  {p.plantilla && (
                    <p className="truncate text-muted-foreground text-xs">
                      {p.plantilla.nombre}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-medium text-muted-foreground text-xs tabular-nums">
                  {new Date(p.fechaProgramada).toLocaleDateString("es-CL", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <ReportarFallaDialog
        equipoId={equipo.id}
        equipoLabel={`${equipo.codigo} — ${equipo.nombre}`}
        onOpenChange={setFallaOpen}
        open={fallaOpen}
      />
      <TicketQrSheet
        onOpenChange={(open) => {
          if (!open) setTicketId(null);
        }}
        ticketId={ticketId}
      />
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
      {children}
    </h2>
  );
}

function StatCard({
  icon,
  label,
  loading,
  value,
}: {
  icon: ReactNode;
  label: string;
  loading?: boolean;
  value?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border bg-card p-3 text-center">
      <span className="text-muted-foreground">{icon}</span>
      {loading ? (
        <Skeleton className="h-6 w-7 rounded-md" />
      ) : (
        <span className="font-semibold text-xl tabular-nums leading-none">
          {value ?? 0}
        </span>
      )}
      <span className="text-[11px] text-muted-foreground leading-tight">
        {label}
      </span>
    </div>
  );
}

function EquipoQrSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
        <Skeleton className="h-8 w-3/4 rounded-md" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <Skeleton className="h-[88px] rounded-xl" />
        <Skeleton className="h-[88px] rounded-xl" />
        <Skeleton className="h-[88px] rounded-xl" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-[68px] w-full rounded-xl" />
        <Skeleton className="h-[68px] w-full rounded-xl" />
      </div>
    </div>
  );
}
