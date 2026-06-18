"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useGenerarOt } from "@/hooks/use-programaciones";
import { usePlantilla } from "@/hooks/use-plantillas";
import type { Programacion } from "@/lib/api/programaciones";
import { cn } from "@/lib/utils";

type Modo = "AUTOMATICA" | "SUGERIDA";

export type GenerarOtDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programacion: Programacion;
};

export function GenerarOtDialog({
  onOpenChange,
  open,
  programacion,
}: GenerarOtDialogProps) {
  const router = useRouter();
  const generarOt = useGenerarOt();
  const plantillaQuery = usePlantilla(programacion.plantillaId ?? "");
  const items = plantillaQuery.data?.items ?? [];

  const [modo, setModo] = useState<Modo>("AUTOMATICA");
  const [observacion, setObservacion] = useState("");
  const [adjust, setAdjust] = useState<Record<string, string>>({});

  const handleGenerar = () => {
    const ajustarItems =
      programacion.plantillaId && items.length > 0
        ? items.map((it) => {
            const raw = adjust[it.repuesto.id];
            const n = raw === undefined ? it.cantidad : Number.parseInt(raw, 10);
            return {
              repuestoId: it.repuesto.id,
              cantidad: Number.isFinite(n) && n >= 0 ? n : it.cantidad,
            };
          })
        : undefined;

    generarOt.mutate(
      {
        id: programacion.id,
        payload: {
          modoReserva: modo,
          observacion: observacion.trim() || undefined,
          ajustarItems,
        },
      },
      {
        onSuccess: (result) => {
          toast.success(`OT ${result.ot.codigo} generada`);
          onOpenChange(false);
          router.push(`/ordenes/${result.ot.id}`);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "No se pudo generar la OT",
          ),
      },
    );
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-5" />
            Generar OT
          </DialogTitle>
          <DialogDescription>
            {programacion.titulo} — {programacion.equipo.codigo}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="font-medium text-sm">Modo de reserva</label>
              <RadioGroup
                className="grid gap-2"
                onValueChange={(v) => setModo(v as Modo)}
                value={modo}
              >
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3 transition-colors hover:bg-secondary/40",
                    modo === "AUTOMATICA" && "border-brand-primary/50 bg-brand-primary/10",
                  )}
                >
                  <RadioGroupItem className="mt-0.5" value="AUTOMATICA" />
                  <span>
                    <span className="block font-medium text-sm">Automática</span>
                    <span className="block text-muted-foreground text-xs">
                      Reserva el stock al generar. Falla si no hay stock suficiente.
                    </span>
                  </span>
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3 transition-colors hover:bg-secondary/40",
                    modo === "SUGERIDA" && "border-brand-primary/50 bg-brand-primary/10",
                  )}
                >
                  <RadioGroupItem className="mt-0.5" value="SUGERIDA" />
                  <span>
                    <span className="block font-medium text-sm">Sugerida</span>
                    <span className="block text-muted-foreground text-xs">
                      No reserva stock; deja los insumos sugeridos para revisar.
                    </span>
                  </span>
                </label>
              </RadioGroup>
            </div>

            {programacion.plantillaId && (
              <div className="space-y-2">
                <label className="font-medium text-sm">
                  Insumos {plantillaQuery.isLoading && "(cargando...)"}
                </label>
                <p className="text-muted-foreground text-xs">
                  Ajusta las cantidades; 0 excluye el insumo.
                </p>
                <div className="space-y-1.5">
                  {items.map((it) => (
                    <div className="flex items-center gap-2" key={it.id}>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        <span className="font-mono text-xs">{it.repuesto.codigo}</span>{" "}
                        {it.repuesto.nombre}
                        <span className="text-muted-foreground text-xs">
                          {" "}
                          (disp. {it.repuesto.stockDisponible})
                        </span>
                      </span>
                      <Input
                        className="w-20"
                        defaultValue={it.cantidad}
                        min={0}
                        onChange={(e) =>
                          setAdjust((prev) => ({
                            ...prev,
                            [it.repuesto.id]: e.target.value,
                          }))
                        }
                        step={1}
                        type="number"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="gen-obs">
                Observación (opcional)
              </label>
              <Input
                id="gen-obs"
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Nota para la OT/ticket"
                value={observacion}
              />
            </div>
          </div>
        </DialogPanel>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button loading={generarOt.isPending} onClick={handleGenerar}>
            {generarOt.isPending ? <Loader2 className="animate-spin" /> : <Zap />}
            Generar OT
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
