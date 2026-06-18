"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { useCreateMarca, useUpdateMarca } from "@/hooks/use-marcas";
import type { Marca, MarcaTipo } from "@/lib/api/marcas";
import { cn } from "@/lib/utils";

const marcaSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(80, "Maximo 80 caracteres"),
  tipo: z.enum(["EQUIPO", "REPUESTO", "AMBOS"]),
});

type MarcaFormValues = z.infer<typeof marcaSchema>;

const EMPTY_VALUES: MarcaFormValues = {
  nombre: "",
  tipo: "EQUIPO",
};

const tipos: { description: string; label: string; value: MarcaTipo }[] = [
  { description: "Marca de equipos.", label: "Equipo", value: "EQUIPO" },
  { description: "Marca de repuestos.", label: "Repuesto", value: "REPUESTO" },
  {
    description: "Aplica a equipos y repuestos.",
    label: "Ambos",
    value: "AMBOS",
  },
];

export type MarcaFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marca?: Marca | null;
};

export function MarcaFormSheet({
  marca,
  onOpenChange,
  open,
}: MarcaFormSheetProps) {
  const createMarca = useCreateMarca();
  const updateMarca = useUpdateMarca();
  const isEdit = Boolean(marca);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<MarcaFormValues>({
    defaultValues: EMPTY_VALUES,
    resolver: zodResolver(marcaSchema),
  });

  useEffect(() => {
    if (!open) return;
    if (marca) {
      reset({ nombre: marca.nombre ?? "", tipo: marca.tipo });
    } else {
      reset(EMPTY_VALUES);
    }
  }, [marca, open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit && marca) {
        await updateMarca.mutateAsync({
          id: marca.id,
          payload: { nombre: values.nombre.trim(), tipo: values.tipo },
        });
        toast.success("Marca actualizada");
      } else {
        await createMarca.mutateAsync({
          nombre: values.nombre.trim(),
          tipo: values.tipo,
        });
        toast.success("Marca creada");
      }
      reset(EMPTY_VALUES);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isEdit
            ? "No se pudo actualizar la marca"
            : "No se pudo crear la marca",
      );
    }
  });

  const isPending = createMarca.isPending || updateMarca.isPending;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar marca" : "Nueva marca"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Modifica los datos de la marca del catálogo."
              : "Registra una marca para equipos y/o repuestos."}
          </SheetDescription>
        </SheetHeader>

        <SheetPanel>
          <form className="space-y-5" id="marca-form" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="nombre">
                Nombre
              </label>
              <Input id="nombre" placeholder="Caterpillar" {...register("nombre")} />
              {errors.nombre && (
                <p className="text-destructive text-xs">{errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-3">
              <label className="font-medium text-sm">Tipo</label>
              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <RadioGroup
                    className="grid gap-2"
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    {tipos.map((tipo) => (
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3 transition-colors hover:bg-secondary/40",
                          field.value === tipo.value &&
                            "border-brand-primary/50 bg-brand-primary/10",
                        )}
                        key={tipo.value}
                      >
                        <RadioGroupItem className="mt-0.5" value={tipo.value} />
                        <span>
                          <span className="block font-medium text-sm">
                            {tipo.label}
                          </span>
                          <span className="block text-muted-foreground text-xs">
                            {tipo.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                )}
              />
            </div>
          </form>
        </SheetPanel>

        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Cancelar</SheetClose>
          <Button form="marca-form" loading={isPending} type="submit">
            {isEdit ? "Guardar cambios" : "Crear marca"}
          </Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
