"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Play, User, Wrench } from "lucide-react";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/core";
import type { TicketEstado } from "@/components/core";
import { useAuth } from "@/contexts/auth-context";
import {
  useFinalizarTicket,
  useIniciarTicket,
  useTicket,
} from "@/hooks/use-tickets";
import { getTicketEquipoLabel } from "@/lib/api/tickets";
import { ReservasSection } from "@/components/inventario/reservas-section";

interface Props {
  ticketId: string | null;
  onOpenChange: (open: boolean) => void;
}

// Bottom sheet con el detalle del ticket del equipo: el mecánico dueño puede
// iniciar/finalizar y cualquier rol con permiso reserva repuestos (ReservasSection).
export function TicketQrSheet({ onOpenChange, ticketId }: Props) {
  return (
    <Sheet onOpenChange={onOpenChange} open={Boolean(ticketId)}>
      <SheetPopup className="max-h-[90dvh] rounded-t-2xl" side="bottom">
        {ticketId ? <TicketSheetBody ticketId={ticketId} /> : null}
      </SheetPopup>
    </Sheet>
  );
}

function TicketSheetBody({ ticketId }: { ticketId: string }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { data: ticket, error, isLoading } = useTicket(ticketId);
  const iniciar = useIniciarTicket(ticketId);
  const finalizar = useFinalizarTicket(ticketId);
  const [observacion, setObservacion] = useState("");

  // Refresca la ficha del equipo (badges de estado de tickets en la lista).
  const refreshResumen = () =>
    queryClient.invalidateQueries({ queryKey: ["equipos", "resumen"] });

  const isOwnerMechanic =
    auth.role === "mechanic" && ticket?.mecanico?.id === auth.id;

  const handleIniciar = () => {
    iniciar.mutate(undefined, {
      onSuccess: () => {
        toast.success("Trabajo iniciado");
        void refreshResumen();
      },
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : "No se pudo iniciar el trabajo",
        ),
    });
  };

  const handleFinalizar = () => {
    if (observacion.trim().length < 3) {
      toast.error("Agrega una observación de cierre");
      return;
    }
    finalizar.mutate(
      { observacion: observacion.trim() },
      {
        onSuccess: () => {
          toast.success("Trabajo finalizado");
          setObservacion("");
          void refreshResumen();
        },
        onError: (err) =>
          toast.error(
            err instanceof Error
              ? err.message
              : "No se pudo finalizar el trabajo",
          ),
      },
    );
  };

  if (isLoading) {
    return (
      <>
        <SheetHeader>
          <Skeleton className="h-6 w-40 rounded-md" />
          <Skeleton className="h-4 w-56 rounded-md" />
        </SheetHeader>
        <SheetPanel className="space-y-3">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </SheetPanel>
      </>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20">
          <AlertTriangle className="size-5" />
        </div>
        <p className="font-medium text-sm">No se pudo cargar el ticket</p>
        <p className="max-w-xs text-muted-foreground text-sm">
          Vuelve a intentarlo en unos segundos.
        </p>
      </div>
    );
  }

  return (
    <>
      <SheetHeader>
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-muted-foreground text-sm">
            {ticket.codigo}
          </span>
          <StatusBadge estado={ticket.estado as TicketEstado} />
        </div>
        <SheetTitle className="text-balance text-lg leading-tight">
          {ticket.titulo}
        </SheetTitle>
        <SheetDescription className="sr-only">
          Detalle del ticket {ticket.codigo}
        </SheetDescription>
      </SheetHeader>

      <SheetPanel className="space-y-5">
        {ticket.descripcion && (
          <p className="text-foreground/90 text-sm leading-relaxed">
            {ticket.descripcion}
          </p>
        )}

        <dl className="space-y-2.5 rounded-xl border bg-muted/40 p-3.5">
          <div className="flex items-center gap-2.5 text-sm">
            <Wrench className="size-4 shrink-0 text-muted-foreground" />
            <dt className="sr-only">Equipo</dt>
            <dd className="min-w-0 truncate">{getTicketEquipoLabel(ticket)}</dd>
          </div>
          {ticket.mecanico?.nombre && (
            <div className="flex items-center gap-2.5 text-sm">
              <User className="size-4 shrink-0 text-muted-foreground" />
              <dt className="sr-only">Mecánico</dt>
              <dd className="min-w-0 truncate">{ticket.mecanico.nombre}</dd>
            </div>
          )}
        </dl>

        {isOwnerMechanic && ticket.estado === "ASIGNADO" && (
          <Button
            className="h-11 w-full"
            loading={iniciar.isPending}
            onClick={handleIniciar}
          >
            <Play />
            Iniciar trabajo
          </Button>
        )}

        {isOwnerMechanic && ticket.estado === "EN_EJECUCION" && (
          <div className="space-y-2.5 rounded-xl border bg-card p-3.5">
            <label className="font-medium text-sm" htmlFor="cierre-obs">
              Observación de cierre
            </label>
            <Textarea
              id="cierre-obs"
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Resumen del trabajo realizado"
              rows={3}
              value={observacion}
            />
            <Button
              className="h-11 w-full"
              loading={finalizar.isPending}
              onClick={handleFinalizar}
            >
              <CheckCircle2 />
              Finalizar trabajo
            </Button>
          </div>
        )}

        <ReservasSection
          ticketEstado={ticket.estado}
          ticketId={ticket.id}
          ticketMecanicoId={ticket.mecanico?.id ?? null}
        />
      </SheetPanel>
    </>
  );
}
