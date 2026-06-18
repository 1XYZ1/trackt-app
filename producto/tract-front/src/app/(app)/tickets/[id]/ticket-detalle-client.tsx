"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  History,
  Image as ImageIcon,
  RefreshCw,
  RotateCcw,
  User,
  UserPlus,
  Wrench,
} from "lucide-react";
import { EmptyState, StatusBadge, TimelineItem } from "@/components/core";
import type { TimelineEvento } from "@/components/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTicket } from "@/hooks/use-tickets";
import { useRole } from "@/contexts/auth-context";
import { getTicketEquipoLabel, type TicketTimelineEvent } from "@/lib/api/tickets";
import { PRIORIDAD_DOT, PRIORIDAD_LABEL } from "@/lib/tickets/format";
import { AsignarMecanicoDialog } from "@/components/tickets/asignar-mecanico-dialog";
import { ReasignarTicketDialog } from "@/components/tickets/reasignar-ticket-dialog";
import {
  ValidarTicketDialog,
  type ValidarMode,
} from "@/components/tickets/validar-ticket-dialog";
import { EvidenciasGrid } from "@/components/tickets/evidencias-grid";
import { ReservasSection } from "@/components/inventario";
import { cn } from "@/lib/utils";

function toTimelineEvento(evento: TicketTimelineEvent): TimelineEvento {
  const title = evento.estadoAnterior
    ? `${evento.estadoAnterior} -> ${evento.estadoNuevo}`
    : `Estado inicial ${evento.estadoNuevo}`;

  return {
    descripcion: evento.observacion ?? undefined,
    estado: evento.estadoNuevo,
    fecha: new Date(evento.timestamp).toLocaleString("es-CL"),
    id: evento.id,
    titulo: title,
    usuario: evento.usuario,
  };
}

/** Fila etiqueta + valor reutilizable del panel "Datos del ticket". */
function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Wrench;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 font-medium text-sm">{children}</div>
    </div>
  );
}

function TicketDetalleSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-36" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full max-w-3xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}

export function TicketDetalleClient({ id }: { id: string }) {
  const { data: ticket, error, isLoading } = useTicket(id);
  const role = useRole();
  const [asignarOpen, setAsignarOpen] = useState(false);
  const [reasignarOpen, setReasignarOpen] = useState(false);
  const [validarMode, setValidarMode] = useState<ValidarMode | null>(null);

  if (isLoading) {
    return <TicketDetalleSkeleton />;
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col gap-4">
        <Button render={<Link href="/tickets" />} size="sm" variant="ghost">
          <ArrowLeft />
          Volver a tickets
        </Button>
        <EmptyState
          icon="ticket"
          message="No se pudo cargar el detalle del ticket desde la API."
          title="Error al cargar ticket"
        />
      </div>
    );
  }

  const orderedTimeline = [...(ticket.timeline ?? [])].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const ordenLabel = ticket.ordenCodigo ?? ticket.ordenId;
  const mecanicoLabel =
    ticket.mecanico?.nombre || ticket.mecanico?.email || "Sin mecanico asignado";

  const isAdmin = role === "admin";
  const isJefe = role === "jefe_taller";
  // admin y jefe_taller pueden asignar/reasignar; admin valida/cierra.
  const canAsignar = (isAdmin || isJefe) && ticket.estado === "PENDIENTE";
  const canReasignar =
    (isAdmin || isJefe) &&
    (ticket.estado === "ASIGNADO" || ticket.estado === "EN_EJECUCION");
  const canValidar = isAdmin && ticket.estado === "EJECUTADO";
  const hasActions = canAsignar || canReasignar || canValidar;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button render={<Link href="/tickets" />} size="sm" variant="ghost">
          <ArrowLeft />
          Volver a tickets
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold text-muted-foreground text-sm tracking-tight">
              {ticket.codigo}
            </span>
            <StatusBadge estado={ticket.estado} />
            <Badge
              className="gap-1.5"
              variant={ticket.prioridad === "ALTA" ? "error" : "secondary"}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  PRIORIDAD_DOT[ticket.prioridad],
                )}
              />
              Prioridad {PRIORIDAD_LABEL[ticket.prioridad]}
            </Badge>
          </div>
          <h1 className="mt-3 text-balance font-semibold text-2xl tracking-tight">
            {ticket.titulo}
          </h1>
          <p className="mt-1.5 max-w-3xl text-pretty text-muted-foreground text-sm">
            {ticket.descripcion}
          </p>
        </div>

        {hasActions && (
          <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
            {canAsignar && (
              <Button
                onClick={() => setAsignarOpen(true)}
                size="sm"
                variant="outline"
              >
                <UserPlus />
                Asignar mecánico
              </Button>
            )}
            {canReasignar && (
              <Button
                onClick={() => setReasignarOpen(true)}
                size="sm"
                variant="outline"
              >
                <RefreshCw />
                Reasignar
              </Button>
            )}
            {canValidar && (
              <>
                <Button
                  onClick={() => setValidarMode("aprobar")}
                  size="sm"
                  variant="default"
                >
                  <CheckCircle2 />
                  Aprobar y cerrar
                </Button>
                <Button
                  onClick={() => setValidarMode("rechazar")}
                  size="sm"
                  variant="destructive"
                >
                  <RotateCcw />
                  Rechazar
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="h-fit rounded-lg border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Datos del ticket</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow icon={ClipboardList} label="OT padre">
              <Button
                className="h-auto p-0 font-medium text-sm"
                render={<Link href={`/ordenes/${ticket.ordenId}`} />}
                variant="link"
              >
                {ordenLabel}
              </Button>
            </InfoRow>

            <InfoRow icon={Wrench} label="Equipo">
              {getTicketEquipoLabel(ticket)}
            </InfoRow>

            <InfoRow icon={User} label="Mecanico asignado">
              {mecanicoLabel}
            </InfoRow>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-muted-foreground" />
              Timeline de estados
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              Trazabilidad cronologica de cambios de estado y observaciones.
            </p>
          </CardHeader>
          <CardContent>
            {orderedTimeline.length > 0 ? (
              // Oculta el conector vertical del último item (no hay evento
              // siguiente al cual conectar).
              <ol className="[&>li:last-child_span.h-full]:hidden">
                {orderedTimeline.map((evento) => (
                  <li key={evento.id}>
                    <TimelineItem evento={toTimelineEvento(evento)} />
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                icon="inbox"
                message="Este ticket aun no tiene eventos de timeline."
                title="Sin eventos registrados"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="size-4 text-muted-foreground" />
            Evidencias
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            Fotos subidas por el mecánico durante la ejecución.
          </p>
        </CardHeader>
        <CardContent>
          <EvidenciasGrid ticketId={ticket.id} />
        </CardContent>
      </Card>

      <ReservasSection
        ticketEstado={ticket.estado}
        ticketId={ticket.id}
        ticketMecanicoId={ticket.mecanico?.id ?? null}
      />

      {canAsignar && (
        <AsignarMecanicoDialog
          onOpenChange={setAsignarOpen}
          open={asignarOpen}
          ticketId={ticket.id}
        />
      )}
      {canReasignar && (
        <ReasignarTicketDialog
          mecanicoActualId={ticket.mecanico?.id ?? null}
          onOpenChange={setReasignarOpen}
          open={reasignarOpen}
          ticketEstado={ticket.estado}
          ticketId={ticket.id}
        />
      )}
      {canValidar && validarMode && (
        <ValidarTicketDialog
          mode={validarMode}
          onOpenChange={(open) => {
            if (!open) setValidarMode(null);
          }}
          open={Boolean(validarMode)}
          ticketId={ticket.id}
        />
      )}
    </div>
  );
}
