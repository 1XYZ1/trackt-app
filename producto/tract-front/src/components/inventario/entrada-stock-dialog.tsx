"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PlusCircle } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEntradaStock } from "@/hooks/use-inventario";
import type { Repuesto } from "@/lib/api/inventario";

interface Props {
  repuesto: Repuesto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EntradaStockDialog({ onOpenChange, open, repuesto }: Props) {
  const [cantidad, setCantidad] = useState<number>(1);
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const entrada = useEntradaStock();

  const reset = () => {
    setCantidad(1);
    setObservacion("");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = () => {
    if (!repuesto) return;
    if (!Number.isFinite(cantidad) || cantidad < 1) {
      setError("La cantidad debe ser un entero mayor o igual a 1");
      return;
    }
    setError(null);
    entrada.mutate(
      {
        id: repuesto.id,
        payload: { cantidad, observacion: observacion.trim() || undefined },
      },
      {
        onSuccess: () => {
          toast.success(`Entrada registrada (+${cantidad})`);
          reset();
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error
              ? err.message
              : "No se pudo registrar la entrada",
          );
        },
      },
    );
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Registrar entrada de stock</DialogTitle>
          <DialogDescription>
            {repuesto
              ? `Aumenta el stock de "${repuesto.codigo} - ${repuesto.nombre}".`
              : "Aumenta el stock del repuesto seleccionado."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-xs">
                <p className="text-muted-foreground">Stock actual</p>
                <p className="mt-1 font-mono font-semibold text-base">
                  {repuesto?.stockActual ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-xs">
                <p className="text-muted-foreground">Disponible</p>
                <p className="mt-1 font-mono font-semibold text-base">
                  {repuesto?.stockDisponible ?? 0}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="entrada-cantidad">
                Cantidad a ingresar
              </label>
              <Input
                id="entrada-cantidad"
                min={1}
                onChange={(e) => {
                  setCantidad(Number(e.target.value));
                  if (error) setError(null);
                }}
                step={1}
                type="number"
                value={cantidad}
              />
            </div>

            <div className="space-y-2">
              <label
                className="font-medium text-sm"
                htmlFor="entrada-observacion"
              >
                Observacion (opcional)
              </label>
              <Textarea
                id="entrada-observacion"
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Compra, devolucion, etc."
                rows={2}
                value={observacion}
              />
            </div>

            {error && <p className="text-destructive text-xs">{error}</p>}
          </div>
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button loading={entrada.isPending} onClick={handleSubmit}>
            <PlusCircle />
            Registrar entrada
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
