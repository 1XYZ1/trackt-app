"use client";

import Link from "next/link";
import { Camera, ChevronRight, Play, Ticket, Wrench } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ListSkeleton, StatusBadge } from "@/components/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useIniciarEjecucion, useMisTickets } from "@/hooks/use-mis-tickets";
import type { MisTicket } from "@/lib/api/mis-tickets";
import { PRIORIDAD_DOT, PRIORIDAD_LABEL } from "@/lib/tickets/format";
import { cn } from "@/lib/utils";

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
      {/* TODO(UX): "Subir foto" deberia auto-abrir input via ?action=upload */}
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
    <Card className="overflow-hidden rounded-xl border-border/70 transition-colors hover:border-border">
      <CardContent className="space-y-4 p-4">
        <Link
          aria-label={`Abrir ticket ${ticket.codigo}`}
          className="group -m-1 flex items-start justify-between gap-3 rounded-lg p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={`/mis-tickets/${ticket.id}`}
        >
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-mono font-semibold text-muted-foreground text-xs tracking-tight">
              <span
                aria-label={`Prioridad ${PRIORIDAD_LABEL[ticket.prioridad]}`}
                className={cn(
                  "size-1.5 rounded-full",
                  PRIORIDAD_DOT[ticket.prioridad],
                )}
              />
              {ticket.codigo}
            </p>
            <h2 className="mt-1 text-balance font-semibold text-lg leading-tight">
              {ticket.titulo}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant={getPriorityVariant(ticket.prioridad)}>
              {PRIORIDAD_LABEL[ticket.prioridad]}
            </Badge>
            <ChevronRight className="size-4 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
          </div>
        </Link>

        <div className="flex flex-wrap gap-2">
          <StatusBadge estado={ticket.estado} />
          <Badge variant="outline">{ticket.ordenCodigo}</Badge>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-secondary/30 p-3 text-sm">
          <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="text-pretty">{ticket.equipo}</span>
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
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-2xl tracking-tight">Mis tickets</h1>
          {!isLoading && !error && tickets.length > 0 && (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-secondary px-2 font-medium text-secondary-foreground text-sm tabular-nums">
              {tickets.length}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Trabajos asignados para ejecutar desde el taller o terreno.
        </p>
      </div>

      {isLoading && <ListSkeleton columns={1} count={3} />}

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
