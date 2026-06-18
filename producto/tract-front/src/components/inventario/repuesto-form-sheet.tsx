"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  useEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const UNIDADES = ["unidad", "litro", "kg", "metro", "caja"] as const;
const CATEGORIAS = [
  "Motor",
  "Filtros",
  "Frenos",
  "Eléctrico",
  "Neumáticos",
] as const;

const requiredOption = <T extends readonly string[]>(
  options: T,
  message: string,
) =>
  z
    .string()
    .min(1, message)
    .refine((value) => options.includes(value), message);

const nonNegativeInteger = (
  requiredMessage: string,
  numberMessage: string,
  negativeMessage: string,
) =>
  z
    .string()
    .trim()
    .min(1, requiredMessage)
    .refine((value) => /^-?\d+$/.test(value), numberMessage)
    .refine((value) => Number(value) >= 0, negativeMessage);

const schema = z.object({
  codigo: z
    .string()
    .min(1, "Codigo es obligatorio")
    .max(60)
    .regex(/^[a-zA-Z0-9-]+$/, "Solo letras, numeros y guiones (sin espacios)"),
  nombre: z.string().min(1, "Nombre es obligatorio").max(120),
  descripcion: z.string().max(500).optional(),
  categoria: requiredOption(CATEGORIAS, "La categoría es obligatoria."),
  unidad: requiredOption(UNIDADES, "La unidad es obligatoria."),
  stockMinimo: nonNegativeInteger(
    "El stock mínimo es obligatorio.",
    "El stock mínimo debe ser un número.",
    "El stock mínimo no puede ser negativo.",
  ),
  stockInicial: nonNegativeInteger(
    "El stock inicial es obligatorio.",
    "El stock inicial debe ser un número.",
    "El stock inicial no puede ser negativo.",
  ),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  codigo: "",
  nombre: "",
  descripcion: "",
  categoria: "",
  unidad: "unidad",
  stockMinimo: "0",
  stockInicial: "0",
};

const integerNavigationKeys = new Set([
  "Backspace",
  "Delete",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "Tab",
]);

function handleIntegerKeyDown(event: KeyboardEvent<HTMLInputElement>) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (integerNavigationKeys.has(event.key)) return;
  if (/^\d$/.test(event.key)) return;

  const input = event.currentTarget;
  const isMinusAtStart =
    event.key === "-" && input.selectionStart === 0 && !input.value.includes("-");

  if (!isMinusAtStart) {
    event.preventDefault();
  }
}

function handleIntegerPaste(event: ClipboardEvent<HTMLInputElement>) {
  const pastedText = event.clipboardData.getData("text");

  if (!/^-?\d+$/.test(pastedText)) {
    event.preventDefault();
  }
}

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
    formState: { errors, isValid },
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
    trigger,
  } = useForm<FormValues>({
    defaultValues: EMPTY,
    mode: "onChange",
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
        stockMinimo: String(repuesto.stockMinimo),
        stockInicial: "0",
      });
    } else {
      lastAuto.current = ""; // create: volver a autogenerar
      reset(EMPTY);
    }
    void trigger();
  }, [repuesto, open, reset, trigger]);

  // Autogenerar codigo desde el nombre (solo create, mientras no se haya
  // editado a mano: el codigo actual sigue siendo el ultimo autogenerado).
  useEffect(() => {
    if (isEdit) return;
    const actual = getValues("codigo");
    if (actual !== "" && actual !== lastAuto.current) return; // editado a mano
    const next = slugCodigo(nombre ?? "");
    lastAuto.current = next;
    setValue("codigo", next, { shouldValidate: true });
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
          categoria: values.categoria,
          unidad: values.unidad,
          stockMinimo: Number(values.stockMinimo),
        };
        await updateRepuesto.mutateAsync({ id: repuesto.id, payload });
        toast.success("Repuesto actualizado");
      } else {
        const payload = {
          codigo: values.codigo.trim().toUpperCase(),
          nombre: values.nombre.trim(),
          descripcion: optionalField(values.descripcion) ?? undefined,
          categoria: values.categoria,
          unidad: values.unidad,
          stockMinimo: Number(values.stockMinimo),
        };
        await createRepuesto.mutateAsync({
          ...payload,
          stockInicial: Number(values.stockInicial),
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
                <Controller
                  control={control}
                  name="unidad"
                  render={({ field }) => (
                    <Select
                      disabled={isPending}
                      onValueChange={(value) => field.onChange(value ?? "")}
                      value={field.value}
                    >
                      <SelectTrigger
                        aria-invalid={Boolean(errors.unidad)}
                        id="unidad"
                        onBlur={field.onBlur}
                      >
                        <SelectValue placeholder="Selecciona una unidad" />
                      </SelectTrigger>
                      <SelectPopup>
                        {UNIDADES.map((unidad) => (
                          <SelectItem key={unidad} value={unidad}>
                            {unidad}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  )}
                />
                {errors.unidad && (
                  <p className="text-destructive text-xs">
                    {errors.unidad.message}
                  </p>
                )}
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
                <Controller
                  control={control}
                  name="categoria"
                  render={({ field }) => (
                    <Select
                      disabled={isPending}
                      onValueChange={(value) => field.onChange(value ?? "")}
                      value={field.value}
                    >
                      <SelectTrigger
                        aria-invalid={Boolean(errors.categoria)}
                        id="categoria"
                        onBlur={field.onBlur}
                      >
                        <SelectValue placeholder="Selecciona categoria" />
                      </SelectTrigger>
                      <SelectPopup>
                        {CATEGORIAS.map((categoria) => (
                          <SelectItem key={categoria} value={categoria}>
                            {categoria}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  )}
                />
                {errors.categoria && (
                  <p className="text-destructive text-xs">
                    {errors.categoria.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="stockMinimo">
                  Stock minimo
                </label>
                <Input
                  id="stockMinimo"
                  inputMode="numeric"
                  onKeyDown={handleIntegerKeyDown}
                  onPaste={handleIntegerPaste}
                  type="text"
                  {...register("stockMinimo")}
                />
                {errors.stockMinimo && (
                  <p className="text-destructive text-xs">
                    {errors.stockMinimo.message}
                  </p>
                )}
              </div>
              {!isEdit && (
                <div className="space-y-2">
                  <label className="font-medium text-sm" htmlFor="stockInicial">
                    Stock inicial
                  </label>
                  <Input
                    id="stockInicial"
                    inputMode="numeric"
                    onKeyDown={handleIntegerKeyDown}
                    onPaste={handleIntegerPaste}
                    type="text"
                    {...register("stockInicial")}
                  />
                  {errors.stockInicial && (
                    <p className="text-destructive text-xs">
                      {errors.stockInicial.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </form>
        </SheetPanel>

        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Cancelar</SheetClose>
          <Button
            disabled={!isValid}
            form="repuesto-form"
            loading={isPending}
            type="submit"
          >
            {isEdit ? "Guardar cambios" : "Crear repuesto"}
          </Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
