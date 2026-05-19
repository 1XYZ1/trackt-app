"use client";

import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDesactivarEquipo } from "@/hooks/use-equipos";
import type { Equipo } from "@/lib/api/equipos";

export type DesactivarEquipoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipo: Equipo | null;
};

export function DesactivarEquipoDialog({
  equipo,
  onOpenChange,
  open,
}: DesactivarEquipoDialogProps) {
  const desactivar = useDesactivarEquipo();

  const handleConfirm = async () => {
    if (!equipo) return;
    try {
      await desactivar.mutateAsync(equipo.id);
      toast.success("Equipo desactivado");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo desactivar el equipo",
      );
    }
  };

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Desactivar equipo</AlertDialogTitle>
          <AlertDialogDescription>
            {equipo
              ? `El equipo "${equipo.codigo} - ${equipo.nombre}" dejara de aparecer en el listado por defecto. No se elimina la informacion; podras reactivarlo mas adelante.`
              : "El equipo dejara de aparecer en el listado por defecto."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" />}>
            Cancelar
          </AlertDialogClose>
          <Button
            loading={desactivar.isPending}
            onClick={handleConfirm}
            variant="destructive"
          >
            Desactivar
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
