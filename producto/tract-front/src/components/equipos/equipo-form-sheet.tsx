"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
import { useCreateEquipo, useEquipo, useUpdateEquipo } from "@/hooks/use-equipos";
import type { Equipo, EquipoEstadoOperativo } from "@/lib/api/equipos";
import { cn } from "@/lib/utils";

const equipoSchema = z.object({
  codigo: z
    .string()
    .min(1, "El codigo es obligatorio")
    .max(60, "Maximo 60 caracteres"),
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(120, "Maximo 120 caracteres"),
  tipo: z.string().max(60, "Maximo 60 caracteres").optional(),
  marca: z.string().max(60, "Maximo 60 caracteres").optional(),
  modelo: z.string().max(60, "Maximo 60 caracteres").optional(),
  numeroSerie: z.string().max(120, "Maximo 120 caracteres").optional(),
  ubicacion: z.string().max(120, "Maximo 120 caracteres").optional(),
  estadoOperativo: z.enum([
    "OPERATIVO",
    "EN_MANTENIMIENTO",
    "FUERA_DE_SERVICIO",
  ]),
  // input type=date -> "YYYY-MM-DD" (o "")
  fechaInstalacion: z.string().optional(),
  fechaCompra: z.string().optional(),
});

type EquipoFormValues = z.infer<typeof equipoSchema>;

const EMPTY_VALUES: EquipoFormValues = {
  codigo: "",
  nombre: "",
  tipo: "",
  marca: "",
  modelo: "",
  numeroSerie: "",
  ubicacion: "",
  estadoOperativo: "OPERATIVO",
  fechaInstalacion: "",
  fechaCompra: "",
};

const ESTADOS: { label: string; value: EquipoEstadoOperativo }[] = [
  { label: "Operativo", value: "OPERATIVO" },
  { label: "En mantenimiento", value: "EN_MANTENIMIENTO" },
  { label: "Fuera de servicio", value: "FUERA_DE_SERVICIO" },
];

// "YYYY-MM-DD" para <input type=date> a partir de un ISO del backend.
const toDateInput = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10) : "";

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

  // Carga el detalle completo al editar: la lista no trae numeroSerie/fechas,
  // y enviarlos vacíos los limpiaría. Sólo se dispara con el sheet abierto.
  const detalleQuery = useEquipo(open && equipo ? equipo.id : "");
  const detalle = detalleQuery.data;

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<EquipoFormValues>({
    defaultValues: EMPTY_VALUES,
    resolver: zodResolver(equipoSchema),
  });

  useEffect(() => {
    if (!open) return;
    if (equipo && detalle) {
      reset({
        codigo: detalle.codigo ?? "",
        nombre: detalle.nombre ?? "",
        tipo: detalle.tipo ?? "",
        marca: detalle.marca ?? "",
        modelo: detalle.modelo ?? "",
        numeroSerie: detalle.numeroSerie ?? "",
        ubicacion: detalle.ubicacion ?? "",
        estadoOperativo: detalle.estadoOperativo,
        fechaInstalacion: toDateInput(detalle.fechaInstalacion),
        fechaCompra: toDateInput(detalle.fechaCompra),
      });
    } else if (!equipo) {
      reset(EMPTY_VALUES);
    }
  }, [equipo, detalle, open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    // En edit, string vacio = limpiar campo → enviar null. En create, omitir.
    const optionalField = (raw: string | undefined) => {
      const trimmed = raw?.trim() ?? "";
      if (trimmed) return trimmed;
      return isEdit ? null : undefined;
    };

    try {
      if (isEdit && equipo) {
        await updateEquipo.mutateAsync({
          id: equipo.id,
          payload: {
            codigo: values.codigo.trim(),
            nombre: values.nombre.trim(),
            tipo: optionalField(values.tipo),
            marca: optionalField(values.marca),
            modelo: optionalField(values.modelo),
            numeroSerie: optionalField(values.numeroSerie),
            ubicacion: optionalField(values.ubicacion),
            estadoOperativo: values.estadoOperativo,
            fechaInstalacion: optionalField(values.fechaInstalacion),
            fechaCompra: optionalField(values.fechaCompra),
          },
        });
        toast.success("Equipo actualizado");
      } else {
        await createEquipo.mutateAsync({
          codigo: values.codigo.trim(),
          nombre: values.nombre.trim(),
          tipo: optionalField(values.tipo) ?? undefined,
          marca: optionalField(values.marca) ?? undefined,
          modelo: optionalField(values.modelo) ?? undefined,
          numeroSerie: optionalField(values.numeroSerie) ?? undefined,
          ubicacion: optionalField(values.ubicacion) ?? undefined,
          estadoOperativo: values.estadoOperativo,
          fechaInstalacion: optionalField(values.fechaInstalacion) ?? undefined,
          fechaCompra: optionalField(values.fechaCompra) ?? undefined,
        });
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="codigo">
                  Código
                </label>
                <Input
                  aria-invalid={!!errors.codigo}
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
                <label className="font-medium text-sm" htmlFor="tipo">
                  Tipo
                </label>
                <Input
                  aria-invalid={!!errors.tipo}
                  id="tipo"
                  placeholder="Excavadora"
                  {...register("tipo")}
                />
                {errors.tipo && (
                  <p className="text-destructive text-xs">
                    {errors.tipo.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="nombre">
                Nombre
              </label>
              <Input
                aria-invalid={!!errors.nombre}
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
                <Input
                  aria-invalid={!!errors.marca}
                  id="marca"
                  placeholder="CAT"
                  {...register("marca")}
                />
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
                <Input
                  aria-invalid={!!errors.modelo}
                  id="modelo"
                  placeholder="320"
                  {...register("modelo")}
                />
                {errors.modelo && (
                  <p className="text-destructive text-xs">
                    {errors.modelo.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="numeroSerie">
                  N° de serie
                </label>
                <Input
                  aria-invalid={!!errors.numeroSerie}
                  id="numeroSerie"
                  placeholder="SN-12345"
                  {...register("numeroSerie")}
                />
                {errors.numeroSerie && (
                  <p className="text-destructive text-xs">
                    {errors.numeroSerie.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="ubicacion">
                  Ubicación
                </label>
                <Input
                  aria-invalid={!!errors.ubicacion}
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="fechaInstalacion">
                  Fecha de instalación
                </label>
                <Controller
                  control={control}
                  name="fechaInstalacion"
                  render={({ field }) => (
                    <DatePicker
                      id="fechaInstalacion"
                      onChange={field.onChange}
                      placeholder="Fecha de instalación"
                      value={field.value ?? ""}
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="fechaCompra">
                  Fecha de compra
                </label>
                <Controller
                  control={control}
                  name="fechaCompra"
                  render={({ field }) => (
                    <DatePicker
                      id="fechaCompra"
                      onChange={field.onChange}
                      placeholder="Fecha de compra"
                      value={field.value ?? ""}
                    />
                  )}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="font-medium text-sm">Estado operativo</label>
              <Controller
                control={control}
                name="estadoOperativo"
                render={({ field }) => (
                  <RadioGroup
                    className="grid gap-2 sm:grid-cols-3"
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    {ESTADOS.map((estado) => (
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary/20 p-3 text-sm transition-colors hover:bg-secondary/40",
                          field.value === estado.value &&
                            "border-brand-primary/50 bg-brand-primary/10",
                        )}
                        key={estado.value}
                      >
                        <RadioGroupItem value={estado.value} />
                        {estado.label}
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
          <Button form="equipo-form" loading={isPending} type="submit">
            {isEdit ? "Guardar cambios" : "Crear equipo"}
          </Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
