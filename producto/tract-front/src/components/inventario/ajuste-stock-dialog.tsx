"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sliders } from "lucide-react";
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
import { useAjusteStock } from "@/hooks/use-inventario";
import type { Repuesto } from "@/lib/api/inventario";

interface Props {
  repuesto: Repuesto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AjusteStockDialog({ onOpenChange, open, repuesto }: Props) {
  const [nuevoStockActual, setNuevoStockActual] = useState<number>(0);
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ajuste = useAjusteStock();

  const reset = () => {
    setNuevoStockActual(repuesto?.stockActual ?? 0);
    setObservacion("");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      // Pre-rellenar con el stock actual al abrir.
      setNuevoStockActual(repuesto?.stockActual ?? 0);
      setObservacion("");
      setError(null);
    } else {
      reset();
    }
    onOpenChange(next);
  };

  const handleSubmit = () => {
    if (!repuesto) return;
    if (!Number.isFinite(nuevoStockActual) || nuevoStockActual < 0) {
      setError("El nuevo stock debe ser un entero mayor o igual a 0");
      return;
    }
    if (nuevoStockActual < repuesto.stockReservado) {
      setError(
        `No puedes bajar de ${repuesto.stockReservado}: hay unidades reservadas`,
      );
      return;
    }
    if (!observacion.trim()) {
      setError("La observacion es obligatoria para un ajuste");
      return;
    }
    setError(null);
    ajuste.mutate(
      {
        id: repuesto.id,
        payload: { nuevoStockActual, observacion: observacion.trim() },
      },
      {
        onSuccess: () => {
          toast.success("Stock ajustado");
          reset();
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "No se pudo ajustar el stock",
          );
        },
      },
    );
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
          <DialogDescription>
            {repuesto
              ? `Setea el stock actual de "${repuesto.codigo} - ${repuesto.nombre}". Util tras conteos fisicos.`
              : "Setea el stock actual del repuesto seleccionado."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-xs">
                <p className="text-muted-foreground">Stock actual</p>
                <p className="mt-1 font-mono font-semibold text-base">
                  {repuesto?.stockActual ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-xs">
                <p className="text-muted-foreground">Reservado</p>
                <p className="mt-1 font-mono font-semibold text-base">
                  {repuesto?.stockReservado ?? 0}
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
              <label className="font-medium text-sm" htmlFor="ajuste-nuevo">
                Nuevo stock actual
              </label>
              <Input
                id="ajuste-nuevo"
                min={0}
                onChange={(e) => {
                  setNuevoStockActual(Number(e.target.value));
                  if (error) setError(null);
                }}
                step={1}
                type="number"
                value={nuevoStockActual}
              />
            </div>

            <div className="space-y-2">
              <label
                className="font-medium text-sm"
                htmlFor="ajuste-observacion"
              >
                Observacion (obligatoria)
              </label>
              <Textarea
                id="ajuste-observacion"
                onChange={(e) => {
                  setObservacion(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Ajuste por conteo fisico, merma, etc."
                rows={3}
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
          <Button loading={ajuste.isPending} onClick={handleSubmit}>
            <Sliders />
            Ajustar
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
