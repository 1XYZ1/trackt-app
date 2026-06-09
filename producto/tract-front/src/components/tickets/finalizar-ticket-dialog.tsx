"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFinalizarTicket } from "@/hooks/use-tickets";

interface Props {
  ticketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirma finalizar la ejecución (EN_EJECUCION → EJECUTADO) desde el kanban.
 * La observación es opcional (FinalizarTicketDto: observacion? max 2000).
 */
export function FinalizarTicketDialog({ ticketId, open, onOpenChange }: Props) {
  const [observacion, setObservacion] = useState("");
  const finalizar = useFinalizarTicket(ticketId);

  const handleSubmit = () => {
    finalizar.mutate(
      { observacion: observacion.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Trabajo finalizado, listo para validar");
          setObservacion("");
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "No se pudo finalizar",
          );
        },
      },
    );
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Finalizar ejecución</DialogTitle>
          <DialogDescription>
            El ticket pasará a EJECUTADO y quedará pendiente de validación.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <Textarea
            onChange={(event) => setObservacion(event.target.value)}
            placeholder="Observación opcional sobre el trabajo realizado."
            value={observacion}
          />
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button loading={finalizar.isPending} onClick={handleSubmit}>
            <CheckCircle2 />
            Finalizar
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
