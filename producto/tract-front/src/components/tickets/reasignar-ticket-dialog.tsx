"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
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
import { useMecanicos } from "@/hooks/use-usuarios";
import { useReasignarTicket } from "@/hooks/use-tickets";
import type { TicketEstado } from "@/components/core";

interface Props {
  ticketId: string;
  ticketEstado: TicketEstado;
  mecanicoActualId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReasignarTicketDialog({
  mecanicoActualId,
  onOpenChange,
  open,
  ticketEstado,
  ticketId,
}: Props) {
  const [mecanicoId, setMecanicoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mecanicos = useMecanicos();
  const reasignar = useReasignarTicket(ticketId);

  // Motivo obligatorio cuando el ticket está EN_EJECUCION (regla del backend).
  const motivoRequerido = ticketEstado === "EN_EJECUCION";

  const resetForm = () => {
    setMecanicoId("");
    setMotivo("");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleSubmit = () => {
    if (!mecanicoId) {
      setError("Selecciona un mecánico");
      return;
    }
    if (mecanicoId === mecanicoActualId) {
      setError("El ticket ya está asignado a ese mecánico");
      return;
    }
    if (motivoRequerido && !motivo.trim()) {
      setError("El motivo es obligatorio para ticket EN_EJECUCION");
      return;
    }
    setError(null);

    reasignar.mutate(
      { mecanicoId, motivo: motivo.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Ticket reasignado");
          resetForm();
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "No se pudo reasignar",
          );
        },
      },
    );
  };

  // Filtrar el mecánico actual de la lista para no permitir reasignar al mismo.
  const opciones = (mecanicos.data ?? []).filter(
    (m) => m.id !== mecanicoActualId,
  );

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Reasignar ticket</DialogTitle>
          <DialogDescription>
            {motivoRequerido
              ? "El ticket está en ejecución. Indica el motivo de la reasignación."
              : "Selecciona el nuevo mecánico responsable del ticket."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {mecanicos.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando mecánicos...
            </div>
          ) : mecanicos.error || !mecanicos.data ? (
            <p className="text-destructive text-sm">
              No se pudieron cargar los mecánicos del tenant.
            </p>
          ) : opciones.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No hay otros mecánicos disponibles en este tenant.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  className="font-medium text-sm"
                  htmlFor="reasignar-mecanico-select"
                >
                  Nuevo mecánico
                </label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  id="reasignar-mecanico-select"
                  onChange={(event) => {
                    setMecanicoId(event.target.value);
                    if (error) setError(null);
                  }}
                  value={mecanicoId}
                >
                  <option value="">— Selecciona —</option>
                  {opciones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName || m.email || m.id}
                      {m.email ? ` (${m.email})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  className="font-medium text-sm"
                  htmlFor="reasignar-motivo"
                >
                  Motivo{motivoRequerido ? " (obligatorio)" : " (opcional)"}
                </label>
                <Textarea
                  id="reasignar-motivo"
                  onChange={(event) => {
                    setMotivo(event.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Ej: sobrecarga del mecánico actual"
                  rows={3}
                  value={motivo}
                />
              </div>

              {error && <p className="text-destructive text-xs">{error}</p>}
            </div>
          )}
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            disabled={!opciones.length}
            loading={reasignar.isPending}
            onClick={handleSubmit}
          >
            <RefreshCw />
            Reasignar
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
