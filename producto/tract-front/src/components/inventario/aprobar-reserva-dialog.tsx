"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Package } from "lucide-react";
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
            Al aprobar se aparta el stock disponible de cada repuesto. Esta
            acción afecta el inventario del taller.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="space-y-4">
            {reserva && (
              <div className="rounded-lg border border-border/60 bg-secondary/15 p-3">
                <p className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Package className="size-3.5" />
                    {reserva.items.length} repuesto
                    {reserva.items.length === 1 ? "" : "s"}
                  </span>
                  <span className="text-muted-foreground">
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {totalItems}
                    </span>{" "}
                    unidad{totalItems === 1 ? "" : "es"}
                  </span>
                </p>
                <ul className="mt-3 space-y-1.5">
                  {reserva.items.map((item) => (
                    <li
                      className="flex items-center justify-between gap-3 text-sm"
                      key={item.id}
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-mono text-xs">
                          {item.repuesto.codigo}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {item.repuesto.nombre}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums">
                        {item.cantidad} {item.repuesto.unidad}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <label
                className="font-medium text-sm"
                htmlFor="aprobar-observacion"
              >
                Observación (opcional)
              </label>
              <Textarea
                id="aprobar-observacion"
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Notas para el registro del movimiento."
                rows={3}
                value={observacion}
              />
            </div>
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
