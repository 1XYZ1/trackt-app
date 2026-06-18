"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Play } from "lucide-react";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

function ticketEstadoVariant(
  estado: string,
): "default" | "secondary" | "outline" | "error" | "warning" {
  switch (estado) {
    case "EN_EJECUCION":
      return "warning";
    case "EJECUTADO":
      return "secondary";
    case "CERRADO":
      return "outline";
    case "CANCELADO":
      return "error";
    default:
      return "default";
  }
}

// Bottom sheet con el detalle del ticket del equipo: el mecánico dueño puede
// iniciar/finalizar y cualquier rol con permiso reserva repuestos (ReservasSection).
export function TicketQrSheet({ onOpenChange, ticketId }: Props) {
  return (
    <Sheet onOpenChange={onOpenChange} open={Boolean(ticketId)}>
      <SheetPopup className="max-h-[90vh] rounded-t-2xl" side="bottom">
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
      <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Cargando ticket...
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="p-8 text-center text-destructive text-sm">
        No se pudo cargar el ticket.
      </div>
    );
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 text-lg">
          <span className="font-mono">{ticket.codigo}</span>
          <Badge variant={ticketEstadoVariant(ticket.estado)}>
            {ticket.estado}
          </Badge>
        </SheetTitle>
        <SheetDescription>{ticket.titulo}</SheetDescription>
      </SheetHeader>

      <SheetPanel className="space-y-4">
        <p className="text-muted-foreground text-sm">{ticket.descripcion}</p>
        <p className="text-muted-foreground text-xs">
          Equipo: {getTicketEquipoLabel(ticket)}
          {ticket.mecanico?.nombre
            ? ` · Mecánico: ${ticket.mecanico.nombre}`
            : ""}
        </p>

        {isOwnerMechanic && ticket.estado === "ASIGNADO" && (
          <Button
            className="w-full"
            loading={iniciar.isPending}
            onClick={handleIniciar}
          >
            <Play />
            Iniciar trabajo
          </Button>
        )}

        {isOwnerMechanic && ticket.estado === "EN_EJECUCION" && (
          <div className="space-y-2 rounded-lg border border-border/60 bg-secondary/15 p-3">
            <label className="font-medium text-sm" htmlFor="cierre-obs">
              Observación de cierre
            </label>
            <Textarea
              id="cierre-obs"
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Resumen del trabajo realizado"
              rows={2}
              value={observacion}
            />
            <Button
              className="w-full"
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
