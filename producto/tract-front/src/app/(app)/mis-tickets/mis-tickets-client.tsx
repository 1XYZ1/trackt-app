"use client";

import Link from "next/link";
import { Camera, Loader2, Play, Ticket, Wrench } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, StatusBadge } from "@/components/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useIniciarEjecucion, useMisTickets } from "@/hooks/use-mis-tickets";
import type { MisTicket } from "@/lib/api/mis-tickets";

function getPriorityVariant(priority: MisTicket["prioridad"]) {
  if (priority === "ALTA") return "error";
  if (priority === "MEDIA") return "warning";
  return "secondary";
}

function TicketAction({ ticket }: { ticket: MisTicket }) {
  const iniciar = useIniciarEjecucion();

  if (ticket.estado === "ASIGNADO") {
    return (
      <Button
        className="h-12 w-full text-base"
        loading={iniciar.isPending}
        onClick={async () => {
          try {
            await iniciar.mutateAsync(ticket.id);
            toast.success("Trabajo iniciado");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "No se pudo iniciar el trabajo",
            );
          }
        }}
      >
        <Play />
        Iniciar trabajo
      </Button>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        className="h-12 text-base"
        render={<Link href={`/mis-tickets/${ticket.id}`} />}
        variant="outline"
      >
        <Camera />
        Subir foto
      </Button>
      <Button
        className="h-12 text-base"
        render={<Link href={`/mis-tickets/${ticket.id}`} />}
      >
        Finalizar
      </Button>
    </div>
  );
}

function TicketMobileCard({ ticket }: { ticket: MisTicket }) {
  return (
    <Card className="rounded-xl border-border/70">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono font-semibold text-muted-foreground text-xs">
              {ticket.codigo}
            </p>
            <h2 className="mt-1 font-semibold text-lg leading-tight">
              {ticket.titulo}
            </h2>
          </div>
          <Badge variant={getPriorityVariant(ticket.prioridad)}>
            {ticket.prioridad}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge estado={ticket.estado} />
          <Badge variant="outline">{ticket.ordenCodigo}</Badge>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-secondary/30 p-3 text-sm">
          <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{ticket.equipo}</span>
        </div>

        <TicketAction ticket={ticket} />
      </CardContent>
    </Card>
  );
}

export function MisTicketsClient() {
  const { data: tickets = [], error, isLoading } = useMisTickets();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
          <Ticket className="size-3.5" />
          Vista mecanico
        </div>
        <h1 className="font-semibold text-2xl tracking-tight">Mis tickets</h1>
        <p className="text-muted-foreground text-sm">
          Trabajos asignados para ejecutar desde el taller o terreno.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-16 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" />
          Cargando tus tickets...
        </div>
      )}

      {!isLoading && error && (
        <EmptyState
          icon="ticket"
          message="No se pudieron cargar tus tickets asignados."
          title="Error al cargar tickets"
        />
      )}

      {!isLoading && !error && tickets.length === 0 && (
        <EmptyState
          icon="ticket"
          message="Cuando te asignen tickets apareceran en esta pantalla."
          title="No tienes tickets asignados"
        />
      )}

      {!isLoading && !error && tickets.length > 0 && (
        <div className="grid gap-3">
          {tickets.map((ticket) => (
            <TicketMobileCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
