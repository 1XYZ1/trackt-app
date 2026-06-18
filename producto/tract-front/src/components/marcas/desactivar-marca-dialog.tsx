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
import { useDesactivarMarca } from "@/hooks/use-marcas";
import type { Marca } from "@/lib/api/marcas";

export type DesactivarMarcaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marca: Marca | null;
};

export function DesactivarMarcaDialog({
  marca,
  onOpenChange,
  open,
}: DesactivarMarcaDialogProps) {
  const desactivar = useDesactivarMarca();

  const handleConfirm = async () => {
    if (!marca) return;
    try {
      await desactivar.mutateAsync(marca.id);
      toast.success("Marca desactivada");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo desactivar la marca",
      );
    }
  };

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Desactivar marca</AlertDialogTitle>
          <AlertDialogDescription>
            {marca
              ? `La marca "${marca.nombre}" dejará de aparecer en los selectores por defecto. No se elimina la información; podrás reactivarla más adelante.`
              : "La marca dejará de aparecer por defecto."}
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
