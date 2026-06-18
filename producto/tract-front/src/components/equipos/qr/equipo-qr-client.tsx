"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  Loader2,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { ReportarFallaDialog } from "./reportar-falla-dialog";
import { TicketQrSheet } from "./ticket-qr-sheet";

const ESTADOS: EquipoEstadoOperativo[] = [
  "OPERATIVO",
  "EN_MANTENIMIENTO",
  "FUERA_DE_SERVICIO",
];

const TICKET_TERMINALES = ["CERRADO", "CANCELADO"];

function ticketEstadoVariant(
  estado: string,
): "default" | "secondary" | "outline" | "error" | "warning" {
  switch (estado) {
    case "EN_EJECUCION":
      return "warning";
    case "EJECUTADO":
      return "secondary";
    case "CANCELADO":
      return "error";
    default:
      return "default";
  }
}

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
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Cargando equipo...
      </div>
    );
  }

  if (equipoError || !equipo) {
    return (
      <Card className="mt-6">
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          No se encontró el equipo de este código QR, o no pertenece a tu
          organización.
        </CardContent>
      </Card>
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

  return (
    <div className="space-y-4 pb-10">
      {/* Cabecera */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-muted-foreground text-sm">
            {equipo.codigo}
          </p>
          <EstadoOperativoBadge estado={estadoActual} />
        </div>
        <h1 className="font-semibold text-2xl leading-tight">{equipo.nombre}</h1>
        <p className="text-muted-foreground text-sm">
          {[equipo.tipo, equipo.marca, equipo.modelo]
            .filter(Boolean)
            .join(" · ") || "Sin datos de modelo"}
          {equipo.ubicacion ? ` — ${equipo.ubicacion}` : ""}
        </p>
      </div>

      {/* Alertas */}
      {resumen && resumen.alertas.length > 0 && (
        <div className="space-y-2">
          {resumen.alertas.map((a) => (
            <div
              className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 text-sm dark:text-amber-300"
              key={a.tipo}
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{a.mensaje}</span>
            </div>
          ))}
        </div>
      )}

      {/* Estado operativo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Estado operativo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {ESTADOS.map((e) => (
              <Button
                className="h-auto whitespace-normal py-2 text-xs"
                disabled={cambiarEstado.isPending}
                key={e}
                onClick={() => handleCambiarEstado(e)}
                size="sm"
                variant={e === estadoActual ? "default" : "outline"}
              >
                {ESTADO_OPERATIVO_LABEL[e]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reportar falla */}
      {canReportar && (
        <Button
          className="w-full"
          onClick={() => setFallaOpen(true)}
          variant="destructive-outline"
        >
          <AlertTriangle />
          Reportar falla
        </Button>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-2">
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

      {/* Tickets activos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tickets activos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {resumenLoading && (
            <p className="text-muted-foreground text-sm">Cargando...</p>
          )}
          {!resumenLoading && ticketsActivos.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Sin tickets activos para este equipo.
            </p>
          )}
          {ticketsActivos.map((t) => (
            <button
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 p-3 text-left transition hover:bg-secondary/30"
              key={t.id}
              onClick={() => setTicketId(t.id)}
              type="button"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">{t.titulo}</p>
                <p className="font-mono text-muted-foreground text-xs">
                  {t.codigo}
                </p>
              </div>
              <Badge variant={ticketEstadoVariant(t.estado)}>{t.estado}</Badge>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Próximas mantenciones */}
      {resumen && resumen.proximasProgramaciones.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Próximas mantenciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resumen.proximasProgramaciones.map((p) => (
              <div
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-3"
                key={p.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{p.titulo}</p>
                  {p.plantilla && (
                    <p className="truncate text-muted-foreground text-xs">
                      {p.plantilla.nombre}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {new Date(p.fechaProgramada).toLocaleDateString("es-CL")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
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
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border/60 p-3 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-semibold text-lg">
        {loading ? "—" : (value ?? 0)}
      </span>
      <span className="text-[11px] text-muted-foreground leading-tight">
        {label}
      </span>
    </div>
  );
}
