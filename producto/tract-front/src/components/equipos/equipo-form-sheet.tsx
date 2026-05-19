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
import { useCreateEquipo, useUpdateEquipo } from "@/hooks/use-equipos";
import type { Equipo } from "@/lib/api/equipos";

const equipoSchema = z.object({
  codigo: z
    .string()
    .min(1, "El codigo es obligatorio")
    .max(60, "Maximo 60 caracteres"),
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(120, "Maximo 120 caracteres"),
  marca: z.string().max(60, "Maximo 60 caracteres").optional(),
  modelo: z.string().max(60, "Maximo 60 caracteres").optional(),
  ubicacion: z.string().max(120, "Maximo 120 caracteres").optional(),
});

type EquipoFormValues = z.infer<typeof equipoSchema>;

const EMPTY_VALUES: EquipoFormValues = {
  codigo: "",
  nombre: "",
  marca: "",
  modelo: "",
  ubicacion: "",
};

export type EquipoFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipo?: Equipo | null;
};

export function EquipoFormSheet({
  equipo,
  onOpenChange,
  open,
}: EquipoFormSheetProps) {
  const createEquipo = useCreateEquipo();
  const updateEquipo = useUpdateEquipo();
  const isEdit = Boolean(equipo);

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<EquipoFormValues>({
    defaultValues: EMPTY_VALUES,
    resolver: zodResolver(equipoSchema),
  });

  // Cargar valores del equipo al abrir en modo edicion; limpiar al cerrar/crear.
  useEffect(() => {
    if (!open) return;
    if (equipo) {
      reset({
        codigo: equipo.codigo ?? "",
        nombre: equipo.nombre ?? "",
        marca: equipo.marca ?? "",
        modelo: equipo.modelo ?? "",
        ubicacion: equipo.ubicacion ?? "",
      });
    } else {
      reset(EMPTY_VALUES);
    }
  }, [equipo, open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    // En edit, string vacio = limpiar campo → enviar null. En create, omitir.
    const optionalField = (raw: string | undefined) => {
      const trimmed = raw?.trim() ?? "";
      if (trimmed) return trimmed;
      return isEdit ? null : undefined;
    };

    try {
      if (isEdit && equipo) {
        const payload = {
          codigo: values.codigo.trim(),
          nombre: values.nombre.trim(),
          marca: optionalField(values.marca),
          modelo: optionalField(values.modelo),
          ubicacion: optionalField(values.ubicacion),
        };
        await updateEquipo.mutateAsync({ id: equipo.id, payload });
        toast.success("Equipo actualizado");
      } else {
        const payload = {
          codigo: values.codigo.trim(),
          nombre: values.nombre.trim(),
          marca: optionalField(values.marca) ?? undefined,
          modelo: optionalField(values.modelo) ?? undefined,
          ubicacion: optionalField(values.ubicacion) ?? undefined,
        };
        await createEquipo.mutateAsync(payload);
        toast.success("Equipo creado");
      }
      reset(EMPTY_VALUES);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isEdit
            ? "No se pudo actualizar el equipo"
            : "No se pudo crear el equipo",
      );
    }
  });

  const isPending = createEquipo.isPending || updateEquipo.isPending;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar equipo" : "Nuevo equipo"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Modifica los datos del equipo operacional."
              : "Registra un nuevo equipo operacional disponible para mantenimiento."}
          </SheetDescription>
        </SheetHeader>

        <SheetPanel>
          <form className="space-y-5" id="equipo-form" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="codigo">
                Codigo
              </label>
              <Input
                id="codigo"
                placeholder="EQ-001"
                {...register("codigo")}
              />
              {errors.codigo && (
                <p className="text-destructive text-xs">
                  {errors.codigo.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="nombre">
                Nombre
              </label>
              <Input
                id="nombre"
                placeholder="Excavadora 320"
                {...register("nombre")}
              />
              {errors.nombre && (
                <p className="text-destructive text-xs">
                  {errors.nombre.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="marca">
                  Marca
                </label>
                <Input id="marca" placeholder="CAT" {...register("marca")} />
                {errors.marca && (
                  <p className="text-destructive text-xs">
                    {errors.marca.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="modelo">
                  Modelo
                </label>
                <Input id="modelo" placeholder="320" {...register("modelo")} />
                {errors.modelo && (
                  <p className="text-destructive text-xs">
                    {errors.modelo.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="ubicacion">
                Ubicacion
              </label>
              <Input
                id="ubicacion"
                placeholder="Mina norte"
                {...register("ubicacion")}
              />
              {errors.ubicacion && (
                <p className="text-destructive text-xs">
                  {errors.ubicacion.message}
                </p>
              )}
            </div>
          </form>
        </SheetPanel>

        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Cancelar</SheetClose>
          <Button form="equipo-form" loading={isPending} type="submit">
            {isEdit ? "Guardar cambios" : "Crear equipo"}
          </Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
