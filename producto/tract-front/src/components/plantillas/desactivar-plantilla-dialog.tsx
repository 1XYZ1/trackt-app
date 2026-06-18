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
import { useDesactivarPlantilla } from "@/hooks/use-plantillas";
import type { Plantilla } from "@/lib/api/plantillas";

export type DesactivarPlantillaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantilla: Plantilla | null;
};

export function DesactivarPlantillaDialog({
  onOpenChange,
  open,
  plantilla,
}: DesactivarPlantillaDialogProps) {
  const desactivar = useDesactivarPlantilla();

  const handleConfirm = async () => {
    if (!plantilla) return;
    try {
      await desactivar.mutateAsync(plantilla.id);
      toast.success("Plantilla desactivada");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo desactivar la plantilla",
      );
    }
  };

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Desactivar plantilla</AlertDialogTitle>
          <AlertDialogDescription>
            {plantilla
              ? `La plantilla "${plantilla.nombre}" dejará de estar disponible para asociar a equipos. Podrás reactivarla más adelante.`
              : "La plantilla dejará de estar disponible por defecto."}
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
