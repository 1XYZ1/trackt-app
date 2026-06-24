"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateTipoEquipo,
  useUpdateTipoEquipo,
} from "@/hooks/use-tipos-equipo";
import type { TipoEquipo } from "@/lib/api/tipos-equipo";

const tipoEquipoSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(80, "Maximo 80 caracteres"),
  descripcion: z.string().max(280, "Maximo 280 caracteres").optional(),
});

type TipoEquipoFormValues = z.infer<typeof tipoEquipoSchema>;

const EMPTY_VALUES: TipoEquipoFormValues = {
  nombre: "",
  descripcion: "",
};

export type TipoEquipoFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoEquipo?: TipoEquipo | null;
};

export function TipoEquipoFormSheet({
  onOpenChange,
  open,
  tipoEquipo,
}: TipoEquipoFormSheetProps) {
  const createTipoEquipo = useCreateTipoEquipo();
  const updateTipoEquipo = useUpdateTipoEquipo();
  const isEdit = Boolean(tipoEquipo);

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<TipoEquipoFormValues>({
    defaultValues: EMPTY_VALUES,
    resolver: zodResolver(tipoEquipoSchema),
  });

  useEffect(() => {
    if (!open) return;
    if (tipoEquipo) {
      reset({
        nombre: tipoEquipo.nombre ?? "",
        descripcion: tipoEquipo.descripcion ?? "",
      });
    } else {
      reset(EMPTY_VALUES);
    }
  }, [tipoEquipo, open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const descripcion = values.descripcion?.trim() ?? "";
    try {
      if (isEdit && tipoEquipo) {
        await updateTipoEquipo.mutateAsync({
          id: tipoEquipo.id,
          payload: {
            nombre: values.nombre.trim(),
            // En edit, string vacío = limpiar campo → enviar null.
            descripcion: descripcion || null,
          },
        });
        toast.success("Tipo de equipo actualizado");
      } else {
        await createTipoEquipo.mutateAsync({
          nombre: values.nombre.trim(),
          descripcion: descripcion || undefined,
        });
        toast.success("Tipo de equipo creado");
      }
      reset(EMPTY_VALUES);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isEdit
            ? "No se pudo actualizar el tipo de equipo"
            : "No se pudo crear el tipo de equipo",
      );
    }
  });

  const isPending = createTipoEquipo.isPending || updateTipoEquipo.isPending;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Editar tipo de equipo" : "Nuevo tipo de equipo"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Modifica los datos del tipo de equipo del catálogo."
              : "Registra un tipo de equipo reutilizable al crear equipos."}
          </SheetDescription>
        </SheetHeader>

        <SheetPanel>
          <form
            className="space-y-5"
            id="tipo-equipo-form"
            onSubmit={onSubmit}
          >
            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="nombre">
                Nombre
              </label>
              <Input
                aria-invalid={!!errors.nombre}
                id="nombre"
                placeholder="Excavadora"
                {...register("nombre")}
              />
              {errors.nombre && (
                <p className="text-destructive text-xs">
                  {errors.nombre.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="descripcion">
                Descripción
              </label>
              <Textarea
                aria-invalid={!!errors.descripcion}
                id="descripcion"
                placeholder="Opcional"
                rows={3}
                {...register("descripcion")}
              />
              {errors.descripcion && (
                <p className="text-destructive text-xs">
                  {errors.descripcion.message}
                </p>
              )}
            </div>
          </form>
        </SheetPanel>

        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Cancelar</SheetClose>
          <Button form="tipo-equipo-form" loading={isPending} type="submit">
            {isEdit ? "Guardar cambios" : "Crear tipo"}
          </Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
