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
import { useDesactivarRepuesto } from "@/hooks/use-inventario";
import type { Repuesto } from "@/lib/api/inventario";

interface Props {
  repuesto: Repuesto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DesactivarRepuestoDialog({
  onOpenChange,
  open,
  repuesto,
}: Props) {
  const desactivar = useDesactivarRepuesto();

  const handleConfirm = async () => {
    if (!repuesto) return;
    try {
      await desactivar.mutateAsync(repuesto.id);
      toast.success("Repuesto desactivado");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo desactivar el repuesto",
      );
    }
  };

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Desactivar repuesto</AlertDialogTitle>
          <AlertDialogDescription>
            {repuesto
              ? `"${repuesto.codigo} - ${repuesto.nombre}" dejara de aparecer para nuevas reservas. Si tiene stock reservado, primero hay que liberarlo. No se elimina la informacion historica.`
              : "El repuesto dejara de aparecer para nuevas reservas."}
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
