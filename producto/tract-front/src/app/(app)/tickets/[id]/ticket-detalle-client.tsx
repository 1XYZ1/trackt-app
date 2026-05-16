"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  Play,
  RotateCcw,
  User,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState, StatusBadge, TimelineItem } from "@/components/core";
import type { TimelineEvento } from "@/components/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTicket } from "@/hooks/use-tickets";
import type { TicketTimelineEvent, TicketTrabajo } from "@/lib/api/tickets";

function getEquipoLabel(ticket: TicketTrabajo) {
  if (ticket.equipo) {
    return `${ticket.equipo.codigo} - ${ticket.equipo.nombre}`;
  }

  return ticket.equipoNombre ?? "Equipo sin informacion";
}

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

export function TicketDetalleClient({ id }: { id: string }) {
  const { data: ticket, error, isLoading } = useTicket(id);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Cargando detalle del ticket...
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <EmptyState
        icon="ticket"
        message="No se pudo cargar el detalle del ticket desde la API."
        title="Error al cargar ticket"
      />
    );
  }

  const orderedTimeline = [...(ticket.timeline ?? [])].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const ordenLabel = ticket.ordenCodigo ?? ticket.ordenId;
  const mecanicoLabel =
    ticket.mecanico?.nombre || ticket.mecanico?.email || "Sin mecanico asignado";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Button render={<Link href="/tickets" />} size="sm" variant="ghost">
            <ArrowLeft />
            Volver a tickets
          </Button>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold text-muted-foreground text-sm">
              {ticket.codigo}
            </span>
            <StatusBadge estado={ticket.estado} />
            <Badge variant={ticket.prioridad === "ALTA" ? "error" : "secondary"}>
              {ticket.prioridad}
            </Badge>
          </div>
          <h1 className="mt-2 font-semibold text-2xl tracking-tight">
            {ticket.titulo}
          </h1>
          <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
            {ticket.descripcion}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => toast.info("Accion disponible en UI-05/UI-06")}
            size="sm"
            variant="outline"
          >
            <Play />
            Cambiar estado
          </Button>
          <Button
            onClick={() => toast.info("Accion disponible en UI-05/UI-06")}
            size="sm"
            variant="outline"
          >
            <RotateCcw />
            Reasignar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="rounded-lg border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Datos del ticket</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <ClipboardList className="size-3.5" />
                OT padre
              </div>
              <Button
                className="mt-1 h-auto p-0 font-medium text-sm"
                render={<Link href={`/ordenes/${ticket.ordenId}`} />}
                variant="link"
              >
                {ordenLabel}
              </Button>
            </div>

            <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Wrench className="size-3.5" />
                Equipo
              </div>
              <p className="mt-1 font-medium text-sm">{getEquipoLabel(ticket)}</p>
            </div>

            <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <User className="size-3.5" />
                Mecanico asignado
              </div>
              <p className="mt-1 font-medium text-sm">{mecanicoLabel}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Timeline de estados</CardTitle>
            <p className="text-muted-foreground text-xs">
              Trazabilidad cronologica de cambios de estado y observaciones.
            </p>
          </CardHeader>
          <CardContent>
            {orderedTimeline.length > 0 ? (
              <div>
                {orderedTimeline.map((evento) => (
                  <TimelineItem evento={toTimelineEvento(evento)} key={evento.id} />
                ))}
              </div>
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
    </div>
  );
}
