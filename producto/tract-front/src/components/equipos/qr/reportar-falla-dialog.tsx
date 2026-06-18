"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Info } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateOrden } from "@/hooks/use-ordenes";
import type { OrdenPrioridad } from "@/lib/api/ordenes";

interface Props {
  equipoId: string;
  equipoLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRIORIDAD_LABEL: Record<OrdenPrioridad, string> = {
  ALTA: "Alta",
  BAJA: "Baja",
  MEDIA: "Media",
};

const PRIORIDADES: OrdenPrioridad[] = ["BAJA", "MEDIA", "ALTA"];

const MIN_DESC = 5;

// Crea una OT de falla para el equipo escaneado. Reusa el flujo existente
// (createOrden / POST /ordenes), permitido a admin/jefe/mecánico.
export function ReportarFallaDialog({
  equipoId,
  equipoLabel,
  onOpenChange,
  open,
}: Props) {
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState<OrdenPrioridad>("MEDIA");
  const [error, setError] = useState<string | null>(null);
  const createOrden = useCreateOrden();

  const reset = () => {
    setDescripcion("");
    setPrioridad("MEDIA");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = () => {
    const desc = descripcion.trim();
    if (desc.length < MIN_DESC) {
      setError(`Describe la falla (mínimo ${MIN_DESC} caracteres)`);
      return;
    }
    setError(null);
    createOrden.mutate(
      { descripcion: desc, equipoId, prioridad },
      {
        onSuccess: (orden) => {
          toast.success(`Falla reportada — ${orden.codigo}`);
          reset();
          onOpenChange(false);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "No se pudo reportar la falla",
          ),
      },
    );
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20">
              <AlertTriangle className="size-4" />
            </span>
            Reportar falla
          </DialogTitle>
          <DialogDescription>{equipoLabel}</DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="falla-desc">Descripción de la falla</Label>
              <Textarea
                aria-invalid={Boolean(error)}
                id="falla-desc"
                onChange={(e) => {
                  setDescripcion(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Ej. Fuga de aceite en el sistema hidráulico"
                rows={4}
                value={descripcion}
              />
              {error && <p className="text-destructive text-xs">{error}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="falla-prioridad">Prioridad</Label>
              <Select
                items={PRIORIDADES.map((p) => ({
                  label: PRIORIDAD_LABEL[p],
                  value: p,
                }))}
                onValueChange={(value) => setPrioridad(value as OrdenPrioridad)}
                value={prioridad}
              >
                <SelectTrigger id="falla-prioridad">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORIDAD_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-muted-foreground text-xs leading-relaxed">
              <Info className="mt-px size-4 shrink-0" />
              <span>
                Se creará una orden de trabajo (OT) pendiente para este equipo.
              </span>
            </div>
          </div>
        </DialogPanel>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            loading={createOrden.isPending}
            onClick={handleSubmit}
            variant="destructive"
          >
            <AlertTriangle />
            Reportar falla
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
