"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw } from "lucide-react";
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
import { useValidarTicket } from "@/hooks/use-tickets";

export type ValidarMode = "aprobar" | "rechazar";

interface Props {
  ticketId: string;
  mode: ValidarMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ValidarTicketDialog({
  ticketId,
  mode,
  open,
  onOpenChange,
}: Props) {
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const validar = useValidarTicket(ticketId);

  const isRechazar = mode === "rechazar";

  const handleSubmit = () => {
    if (isRechazar && observacion.trim().length === 0) {
      setError("Indica el motivo del rechazo");
      return;
    }

    setError(null);

    validar.mutate(
      {
        aprobado: !isRechazar,
        observacion: observacion.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            isRechazar
              ? "Ticket rechazado, volvió a ejecución"
              : "Ticket validado y cerrado",
          );
          setObservacion("");
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "No se pudo procesar",
          );
        },
      },
    );
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {isRechazar ? "Rechazar ticket" : "Aprobar y cerrar ticket"}
          </DialogTitle>
          <DialogDescription>
            {isRechazar
              ? "Indica el motivo del rechazo. El ticket volverá a EN_EJECUCION para retrabajo."
              : "El ticket pasará a CERRADO. La OT padre se cerrará automáticamente si todos sus tickets están cerrados."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="space-y-2">
            <Textarea
              onChange={(event) => {
                setObservacion(event.target.value);
                if (error) setError(null);
              }}
              placeholder={
                isRechazar
                  ? "Ej: falta evidencia fotográfica del filtro reemplazado."
                  : "Observación opcional sobre la validación."
              }
              value={observacion}
            />
            {error && <p className="text-destructive text-xs">{error}</p>}
          </div>
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            loading={validar.isPending}
            onClick={handleSubmit}
            variant={isRechazar ? "destructive" : "default"}
          >
            {isRechazar ? (
              <>
                <RotateCcw />
                Rechazar
              </>
            ) : (
              <>
                <CheckCircle2 />
                Aprobar y cerrar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
