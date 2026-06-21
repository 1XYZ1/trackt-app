"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { GripVertical, Plus, Trash2 } from "lucide-react";
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
import { useCreatePlantilla, useUpdatePlantilla } from "@/hooks/use-plantillas";
import {
  getChecklist,
  type Plantilla,
  type PlantillaDetalle,
} from "@/lib/api/plantillas";

const MAX_PASOS = 100;
const MAX_PASO_LEN = 500;

const schema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio").max(120),
  descripcion: z.string().max(500).optional(),
  tipoEquipo: z.string().max(80).optional(),
  frecuencia: z.string().max(80).optional(),
  pasos: z.array(z.object({ value: z.string().max(MAX_PASO_LEN) })),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  nombre: "",
  descripcion: "",
  tipoEquipo: "",
  frecuencia: "",
  pasos: [],
};

export type PlantillaFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantilla?: Plantilla | PlantillaDetalle | null;
};

export function PlantillaFormSheet({
  onOpenChange,
  open,
  plantilla,
}: PlantillaFormSheetProps) {
  const createPlantilla = useCreatePlantilla();
  const updatePlantilla = useUpdatePlantilla();
  const isEdit = Boolean(plantilla);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<FormValues>({
    defaultValues: EMPTY,
    resolver: zodResolver(schema),
  });

  const { append, fields, remove } = useFieldArray({ control, name: "pasos" });

  useEffect(() => {
    if (!open) return;
    if (plantilla) {
      reset({
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion ?? "",
        tipoEquipo: plantilla.tipoEquipo ?? "",
        frecuencia: plantilla.frecuencia ?? "",
        pasos: getChecklist(plantilla.metadata).map((value) => ({ value })),
      });
    } else {
      reset(EMPTY);
    }
  }, [plantilla, open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const optionalField = (raw: string | undefined) => {
      const trimmed = raw?.trim() ?? "";
      if (trimmed) return trimmed;
      return isEdit ? null : undefined;
    };

    const cleanChecklist = values.pasos
      .map((p) => p.value.trim())
      .filter((p) => p.length > 0);

    try {
      if (isEdit && plantilla) {
        await updatePlantilla.mutateAsync({
          id: plantilla.id,
          payload: {
            nombre: values.nombre.trim(),
            descripcion: optionalField(values.descripcion),
            tipoEquipo: optionalField(values.tipoEquipo),
            frecuencia: optionalField(values.frecuencia),
            checklist: cleanChecklist,
          },
        });
        toast.success("Plantilla actualizada");
      } else {
        await createPlantilla.mutateAsync({
          nombre: values.nombre.trim(),
          descripcion: optionalField(values.descripcion) ?? undefined,
          tipoEquipo: optionalField(values.tipoEquipo) ?? undefined,
          frecuencia: optionalField(values.frecuencia) ?? undefined,
          checklist: cleanChecklist.length > 0 ? cleanChecklist : undefined,
        });
        toast.success("Plantilla creada");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isEdit
            ? "No se pudo actualizar la plantilla"
            : "No se pudo crear la plantilla",
      );
    }
  });

  const isPending = createPlantilla.isPending || updatePlantilla.isPending;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Editar plantilla" : "Nueva plantilla"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Modifica los datos y el checklist de la plantilla."
              : "Define una plantilla de mantenimiento reutilizable."}
          </SheetDescription>
        </SheetHeader>

        <SheetPanel>
          <form className="space-y-5" id="plantilla-form" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="nombre">
                Nombre
              </label>
              <Input
                aria-invalid={!!errors.nombre}
                id="nombre"
                placeholder="Mantención preventiva 250h"
                {...register("nombre")}
              />
              {errors.nombre && (
                <p className="text-destructive text-xs">{errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="descripcion">
                Descripción (opcional)
              </label>
              <Textarea
                id="descripcion"
                placeholder="Alcance y notas de la mantención."
                rows={2}
                {...register("descripcion")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="tipoEquipo">
                  Tipo de equipo
                </label>
                <Input
                  id="tipoEquipo"
                  placeholder="Excavadora"
                  {...register("tipoEquipo")}
                />
              </div>
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="frecuencia">
                  Frecuencia
                </label>
                <Input
                  id="frecuencia"
                  placeholder="Cada 250 horas"
                  {...register("frecuencia")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-medium text-sm">
                  Checklist ({fields.length})
                </label>
                <Button
                  disabled={fields.length >= MAX_PASOS}
                  onClick={() => append({ value: "" })}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus />
                  Paso
                </Button>
              </div>
              {fields.length === 0 && (
                <p className="text-muted-foreground text-xs">
                  Agrega pasos de verificación (opcional).
                </p>
              )}
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div className="flex items-center gap-2" key={field.id}>
                    <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                    <Input
                      maxLength={MAX_PASO_LEN}
                      placeholder={`Paso ${idx + 1}`}
                      {...register(`pasos.${idx}.value`)}
                    />
                    <Button
                      onClick={() => remove(idx)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </SheetPanel>

        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Cancelar</SheetClose>
          <Button form="plantilla-form" loading={isPending} type="submit">
            {isEdit ? "Guardar cambios" : "Crear plantilla"}
          </Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
