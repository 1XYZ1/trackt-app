"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
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
import { useCreateOrden } from "@/hooks/use-ordenes";
import type { OrdenPrioridad } from "@/lib/api/ordenes";

interface Props {
  equipoId: string;
  equipoLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRIORIDADES: OrdenPrioridad[] = ["BAJA", "MEDIA", "ALTA"];

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
    if (desc.length < 5) {
      setError("Describe la falla (mínimo 5 caracteres)");
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
            <AlertTriangle className="size-5" />
            Reportar falla
          </DialogTitle>
          <DialogDescription>{equipoLabel}</DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-medium text-sm" htmlFor="falla-desc">
                Descripción de la falla
              </label>
              <Textarea
                id="falla-desc"
                onChange={(e) => {
                  setDescripcion(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Ej. Fuga de aceite en el sistema hidráulico"
                rows={4}
                value={descripcion}
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-sm" htmlFor="falla-prioridad">
                Prioridad
              </label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                id="falla-prioridad"
                onChange={(e) =>
                  setPrioridad(e.target.value as OrdenPrioridad)
                }
                value={prioridad}
              >
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-destructive text-xs">{error}</p>}

            <p className="text-muted-foreground text-xs">
              Se creará una orden de trabajo (OT) pendiente para este equipo.
            </p>
          </div>
        </DialogPanel>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button loading={createOrden.isPending} onClick={handleSubmit}>
            <AlertTriangle />
            Reportar falla
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
