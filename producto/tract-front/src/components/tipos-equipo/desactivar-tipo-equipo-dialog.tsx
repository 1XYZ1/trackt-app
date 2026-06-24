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
import { useDesactivarTipoEquipo } from "@/hooks/use-tipos-equipo";
import type { TipoEquipo } from "@/lib/api/tipos-equipo";

export type DesactivarTipoEquipoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoEquipo: TipoEquipo | null;
};

export function DesactivarTipoEquipoDialog({
  onOpenChange,
  open,
  tipoEquipo,
}: DesactivarTipoEquipoDialogProps) {
  const desactivar = useDesactivarTipoEquipo();

  const handleConfirm = async () => {
    if (!tipoEquipo) return;
    try {
      await desactivar.mutateAsync(tipoEquipo.id);
      toast.success("Tipo de equipo desactivado");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo desactivar el tipo de equipo",
      );
    }
  };

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Desactivar tipo de equipo</AlertDialogTitle>
          <AlertDialogDescription>
            {tipoEquipo
              ? `El tipo "${tipoEquipo.nombre}" dejará de aparecer en los selectores por defecto. Los equipos que ya lo usan no se modifican; podrás reactivarlo más adelante.`
              : "El tipo de equipo dejará de aparecer por defecto."}
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
