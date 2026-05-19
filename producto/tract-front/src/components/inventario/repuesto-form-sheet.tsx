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
import { useCreateRepuesto, useUpdateRepuesto } from "@/hooks/use-inventario";
import type { Repuesto } from "@/lib/api/inventario";

const schema = z.object({
  codigo: z.string().min(1, "Codigo es obligatorio").max(60),
  nombre: z.string().min(1, "Nombre es obligatorio").max(120),
  descripcion: z.string().max(500).optional(),
  categoria: z.string().max(60).optional(),
  unidad: z.string().max(20).optional(),
  // valueAsNumber en register convierte el string del <input type="number"> a number.
  stockMinimo: z.number().int().min(0).optional(),
  stockInicial: z.number().int().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  codigo: "",
  nombre: "",
  descripcion: "",
  categoria: "",
  unidad: "unidad",
  stockMinimo: 0,
  stockInicial: 0,
};

export type RepuestoFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repuesto?: Repuesto | null;
};

export function RepuestoFormSheet({
  onOpenChange,
  open,
  repuesto,
}: RepuestoFormSheetProps) {
  const createRepuesto = useCreateRepuesto();
  const updateRepuesto = useUpdateRepuesto();
  const isEdit = Boolean(repuesto);

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<FormValues>({
    defaultValues: EMPTY,
    resolver: zodResolver(schema),
  });

  // Recargar form al abrir; limpiar al cerrar/crear.
  useEffect(() => {
    if (!open) return;
    if (repuesto) {
      reset({
        codigo: repuesto.codigo,
        nombre: repuesto.nombre,
        descripcion: repuesto.descripcion ?? "",
        categoria: repuesto.categoria ?? "",
        unidad: repuesto.unidad,
        stockMinimo: repuesto.stockMinimo,
        stockInicial: 0,
      });
    } else {
      reset(EMPTY);
    }
  }, [repuesto, open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    // En edit, string vacio = limpiar campo → null. En create, omitir.
    const optionalField = (raw: string | undefined) => {
      const trimmed = raw?.trim() ?? "";
      if (trimmed) return trimmed;
      return isEdit ? null : undefined;
    };

    try {
      if (isEdit && repuesto) {
        const payload = {
          codigo: values.codigo.trim(),
          nombre: values.nombre.trim(),
          descripcion: optionalField(values.descripcion),
          categoria: optionalField(values.categoria),
          unidad: values.unidad?.trim() || undefined,
          stockMinimo: values.stockMinimo ?? 0,
        };
        await updateRepuesto.mutateAsync({ id: repuesto.id, payload });
        toast.success("Repuesto actualizado");
      } else {
        const payload = {
          codigo: values.codigo.trim(),
          nombre: values.nombre.trim(),
          descripcion: optionalField(values.descripcion) ?? undefined,
          categoria: optionalField(values.categoria) ?? undefined,
          unidad: values.unidad?.trim() || undefined,
          stockMinimo: values.stockMinimo ?? 0,
        };
        await createRepuesto.mutateAsync({
          ...payload,
          stockInicial: values.stockInicial ?? 0,
        });
        toast.success("Repuesto creado");
      }
      reset(EMPTY);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isEdit
            ? "No se pudo actualizar el repuesto"
            : "No se pudo crear el repuesto",
      );
    }
  });

  const isPending = createRepuesto.isPending || updateRepuesto.isPending;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Editar repuesto" : "Nuevo repuesto"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Modifica los datos del repuesto."
              : "Registra un nuevo repuesto en el inventario del taller."}
          </SheetDescription>
        </SheetHeader>

        <SheetPanel>
          <form className="space-y-5" id="repuesto-form" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="codigo">
                  Codigo
                </label>
                <Input
                  id="codigo"
                  placeholder="FILTRO-001"
                  {...register("codigo")}
                />
                {errors.codigo && (
                  <p className="text-destructive text-xs">
                    {errors.codigo.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="unidad">
                  Unidad
                </label>
                <Input
                  id="unidad"
                  placeholder="unidad / litro / metro"
                  {...register("unidad")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="nombre">
                Nombre
              </label>
              <Input
                id="nombre"
                placeholder="Filtro de aceite"
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
                Descripcion (opcional)
              </label>
              <Textarea
                id="descripcion"
                placeholder="Filtro de aceite motor, compatible con..."
                rows={2}
                {...register("descripcion")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="categoria">
                  Categoria
                </label>
                <Input
                  id="categoria"
                  placeholder="Motor"
                  {...register("categoria")}
                />
              </div>
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="stockMinimo">
                  Stock minimo
                </label>
                <Input
                  id="stockMinimo"
                  min={0}
                  step={1}
                  type="number"
                  {...register("stockMinimo", { valueAsNumber: true })}
                />
              </div>
              {!isEdit && (
                <div className="space-y-2">
                  <label className="font-medium text-sm" htmlFor="stockInicial">
                    Stock inicial
                  </label>
                  <Input
                    id="stockInicial"
                    min={0}
                    step={1}
                    type="number"
                    {...register("stockInicial", { valueAsNumber: true })}
                  />
                </div>
              )}
            </div>
          </form>
        </SheetPanel>

        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Cancelar</SheetClose>
          <Button form="repuesto-form" loading={isPending} type="submit">
            {isEdit ? "Guardar cambios" : "Crear repuesto"}
          </Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
