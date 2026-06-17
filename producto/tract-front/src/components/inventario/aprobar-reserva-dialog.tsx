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
import { useAprobarReserva } from "@/hooks/use-inventario";
import type { ReservaRepuesto } from "@/lib/api/inventario";

interface Props {
  reserva: ReservaRepuesto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AprobarReservaDialog({
  reserva,
  open,
  onOpenChange,
}: Props) {
  const [observacion, setObservacion] = useState("");
  const aprobar = useAprobarReserva(reserva?.ticketId);

  const handleConfirm = () => {
    if (!reserva) return;
    aprobar.mutate(
      { id: reserva.id, payload: { observacion: observacion.trim() || undefined } },
      {
        onSuccess: () => {
          toast.success("Reserva aprobada");
          setObservacion("");
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error
              ? err.message
              : "No se pudo aprobar la reserva",
          );
        },
      },
    );
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setObservacion("");
    onOpenChange(next);
  };

  const totalItems = reserva?.items.reduce(
    (acc, it) => acc + it.cantidad,
    0,
  );

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Aprobar reserva de repuestos</DialogTitle>
          <DialogDescription>
            {reserva
              ? `Al aprobar, se reservaran ${totalItems} unidades distribuidas en ${reserva.items.length} item(s). El stock disponible se ajustara.`
              : "Confirma la aprobacion de la solicitud."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="space-y-2">
            <label
              className="font-medium text-sm"
              htmlFor="aprobar-observacion"
            >
              Observacion (opcional)
            </label>
            <Textarea
              id="aprobar-observacion"
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Notas para el registro del movimiento."
              rows={3}
              value={observacion}
            />
          </div>
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button loading={aprobar.isPending} onClick={handleConfirm}>
            <CheckCircle2 />
            Aprobar reserva
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
