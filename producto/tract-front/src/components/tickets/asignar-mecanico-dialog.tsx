"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, User } from "lucide-react";
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
import { useMecanicos } from "@/hooks/use-usuarios";
import { useAsignarTicket } from "@/hooks/use-tickets";

interface Props {
  ticketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AsignarMecanicoDialog({ ticketId, open, onOpenChange }: Props) {
  const [mecanicoId, setMecanicoId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mecanicos = useMecanicos();
  const asignar = useAsignarTicket(ticketId);

  const handleSubmit = () => {
    if (!mecanicoId) {
      setError("Selecciona un mecánico");
      return;
    }
    setError(null);

    asignar.mutate(
      { mecanicoId },
      {
        onSuccess: () => {
          toast.success("Mecánico asignado");
          setMecanicoId("");
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "No se pudo asignar");
        },
      },
    );
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Asignar mecánico</DialogTitle>
          <DialogDescription>
            Selecciona el mecánico responsable. El ticket pasará a ASIGNADO.
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
          ) : mecanicos.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No hay mecánicos disponibles en este tenant.
            </p>
          ) : (
            <div className="space-y-2">
              <label
                className="font-medium text-sm"
                htmlFor="mecanico-select"
              >
                Mecánico
              </label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                id="mecanico-select"
                onChange={(event) => {
                  setMecanicoId(event.target.value);
                  if (error) setError(null);
                }}
                value={mecanicoId}
              >
                <option value="">— Selecciona —</option>
                {mecanicos.data.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName || m.email || m.id}
                    {m.email ? ` (${m.email})` : ""}
                  </option>
                ))}
              </select>
              {error && <p className="text-destructive text-xs">{error}</p>}
            </div>
          )}
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            disabled={!mecanicos.data?.length}
            loading={asignar.isPending}
            onClick={handleSubmit}
          >
            <User />
            Asignar
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
