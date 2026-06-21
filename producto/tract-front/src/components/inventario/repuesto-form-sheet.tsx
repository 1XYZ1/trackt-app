"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { MarcaSelect } from "@/components/marcas";
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
import { slugCodigo } from "@/lib/strings";

const schema = z.object({
  codigo: z
    .string()
    .min(1, "El código es obligatorio")
    .max(60)
    .regex(/^[a-zA-Z0-9-]+$/, "Solo letras, números y guiones (sin espacios)"),
  nombre: z.string().min(1, "El nombre es obligatorio").max(120),
  descripcion: z.string().max(500).optional(),
  categoria: z.string().max(60).optional(),
  unidad: z.string().max(20).optional(),
  // valueAsNumber en register convierte el string del <input type="number"> a number.
  stockMinimo: z.number().int().min(0).optional(),
  stockInicial: z.number().int().min(0).optional(),
  marcaId: z.string().optional(),
  codigoFabricante: z.string().max(120).optional(),
  ubicacionBodega: z.string().max(120).optional(),
  proveedor: z.string().max(120).optional(),
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
  marcaId: "",
  codigoFabricante: "",
  ubicacionBodega: "",
  proveedor: "",
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
    control,
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<FormValues>({
    defaultValues: EMPTY,
    resolver: zodResolver(schema),
  });

  // En create, el codigo se autogenera del nombre. Guardamos el ultimo valor
  // autogenerado: si el usuario edita el codigo a mano (diverge de este), se
  // deja de sobreescribir.
  const lastAuto = useRef("");
  const nombre = useWatch({ control, name: "nombre" });

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
        marcaId: repuesto.marcaId ?? "",
        codigoFabricante: repuesto.codigoFabricante ?? "",
        ubicacionBodega: repuesto.ubicacionBodega ?? "",
        proveedor: repuesto.proveedor ?? "",
      });
    } else {
      lastAuto.current = ""; // create: volver a autogenerar
      reset(EMPTY);
    }
  }, [repuesto, open, reset]);

  // Autogenerar codigo desde el nombre (solo create, mientras no se haya
  // editado a mano: el codigo actual sigue siendo el ultimo autogenerado).
  useEffect(() => {
    if (isEdit) return;
    const actual = getValues("codigo");
    if (actual !== "" && actual !== lastAuto.current) return; // editado a mano
    const next = slugCodigo(nombre ?? "");
    lastAuto.current = next;
    setValue("codigo", next, { shouldValidate: false });
  }, [nombre, isEdit, getValues, setValue]);

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
          codigo: values.codigo.trim().toUpperCase(),
          nombre: values.nombre.trim(),
          descripcion: optionalField(values.descripcion),
          categoria: optionalField(values.categoria),
          unidad: values.unidad?.trim() || undefined,
          stockMinimo: values.stockMinimo ?? 0,
          marcaId: optionalField(values.marcaId),
          codigoFabricante: optionalField(values.codigoFabricante),
          ubicacionBodega: optionalField(values.ubicacionBodega),
          proveedor: optionalField(values.proveedor),
        };
        await updateRepuesto.mutateAsync({ id: repuesto.id, payload });
        toast.success("Repuesto actualizado");
      } else {
        const payload = {
          codigo: values.codigo.trim().toUpperCase(),
          nombre: values.nombre.trim(),
          descripcion: optionalField(values.descripcion) ?? undefined,
          categoria: optionalField(values.categoria) ?? undefined,
          unidad: values.unidad?.trim() || undefined,
          stockMinimo: values.stockMinimo ?? 0,
          marcaId: optionalField(values.marcaId) ?? undefined,
          codigoFabricante: optionalField(values.codigoFabricante) ?? undefined,
          ubicacionBodega: optionalField(values.ubicacionBodega) ?? undefined,
          proveedor: optionalField(values.proveedor) ?? undefined,
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
                  Código
                </label>
                <Input
                  aria-invalid={!!errors.codigo}
                  className="uppercase"
                  id="codigo"
                  placeholder="FILTRO-001"
                  {...register("codigo")}
                />
                {errors.codigo ? (
                  <p className="text-destructive text-xs">
                    {errors.codigo.message}
                  </p>
                ) : (
                  !isEdit && (
                    <p className="text-muted-foreground text-xs">
                      Se genera del nombre; puedes editarlo.
                    </p>
                  )
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
                aria-invalid={!!errors.nombre}
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
                Descripción (opcional)
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
                  Categoría
                </label>
                <Input
                  id="categoria"
                  placeholder="Motor"
                  {...register("categoria")}
                />
              </div>
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="stockMinimo">
                  Stock mínimo
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

            <div className="space-y-2">
              <label className="font-medium text-sm">Marca</label>
              <Controller
                control={control}
                name="marcaId"
                render={({ field }) => (
                  <MarcaSelect
                    onChange={(id) => field.onChange(id ?? "")}
                    tipo="REPUESTO"
                    value={field.value || null}
                  />
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="codigoFabricante">
                  Código fabricante
                </label>
                <Input
                  id="codigoFabricante"
                  placeholder="OEM-123"
                  {...register("codigoFabricante")}
                />
              </div>
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="ubicacionBodega">
                  Ubicación bodega
                </label>
                <Input
                  id="ubicacionBodega"
                  placeholder="Pasillo A-3"
                  {...register("ubicacionBodega")}
                />
              </div>
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="proveedor">
                  Proveedor
                </label>
                <Input
                  id="proveedor"
                  placeholder="Proveedor S.A."
                  {...register("proveedor")}
                />
              </div>
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
