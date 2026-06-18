"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { EquipoSelect } from "@/components/equipos";
import { PlantillaSelect } from "@/components/plantillas";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateProgramacion,
  useUpdateProgramacion,
} from "@/hooks/use-programaciones";
import type { Prioridad, Programacion } from "@/lib/api/programaciones";
import { cn } from "@/lib/utils";
import { ResponsableSelect } from "./responsable-select";

const schema = z
  .object({
    equipoId: z.string().min(1, "Selecciona un equipo"),
    plantillaId: z.string().optional(),
    titulo: z.string().max(120).optional(),
    descripcion: z.string().max(500).optional(),
    fechaProgramada: z.string().min(1, "Indica la fecha programada"),
    responsableId: z.string().optional(),
    prioridad: z.enum(["BAJA", "MEDIA", "ALTA"]),
    recurrencia: z.string().max(120).optional(),
  })
  .refine((d) => Boolean(d.titulo?.trim() || d.plantillaId), {
    message: "Indica un título o asocia una plantilla",
    path: ["titulo"],
  });

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  equipoId: "",
  plantillaId: "",
  titulo: "",
  descripcion: "",
  fechaProgramada: "",
  responsableId: "",
  prioridad: "MEDIA",
  recurrencia: "",
};

const PRIORIDADES: { label: string; value: Prioridad }[] = [
  { label: "Baja", value: "BAJA" },
  { label: "Media", value: "MEDIA" },
  { label: "Alta", value: "ALTA" },
];

// ISO -> "YYYY-MM-DDTHH:mm" para <input type=datetime-local>.
const toLocalInput = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 16) : "";

export type ProgramacionFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programacion?: Programacion | null;
};

export function ProgramacionFormSheet({
  onOpenChange,
  open,
  programacion,
}: ProgramacionFormSheetProps) {
  const createProgramacion = useCreateProgramacion();
  const updateProgramacion = useUpdateProgramacion();
  const isEdit = Boolean(programacion);

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

  useEffect(() => {
    if (!open) return;
    if (programacion) {
      reset({
        equipoId: programacion.equipoId,
        plantillaId: programacion.plantillaId ?? "",
        titulo: programacion.titulo ?? "",
        descripcion: programacion.descripcion ?? "",
        fechaProgramada: toLocalInput(programacion.fechaProgramada),
        responsableId: programacion.responsableId ?? "",
        prioridad: programacion.prioridad,
        recurrencia: programacion.recurrencia ?? "",
      });
    } else {
      reset(EMPTY);
    }
  }, [programacion, open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const optionalField = (raw: string | undefined) => {
      const trimmed = raw?.trim() ?? "";
      if (trimmed) return trimmed;
      return isEdit ? null : undefined;
    };
    const fechaIso = new Date(values.fechaProgramada).toISOString();

    try {
      if (isEdit && programacion) {
        await updateProgramacion.mutateAsync({
          id: programacion.id,
          payload: {
            titulo: values.titulo?.trim() || undefined,
            descripcion: optionalField(values.descripcion),
            plantillaId: values.plantillaId || null,
            fechaProgramada: fechaIso,
            responsableId: values.responsableId || null,
            prioridad: values.prioridad,
            recurrencia: optionalField(values.recurrencia),
          },
        });
        toast.success("Programación actualizada");
      } else {
        await createProgramacion.mutateAsync({
          equipoId: values.equipoId,
          plantillaId: values.plantillaId || undefined,
          titulo: values.titulo?.trim() || undefined,
          descripcion: values.descripcion?.trim() || undefined,
          fechaProgramada: fechaIso,
          responsableId: values.responsableId || undefined,
          prioridad: values.prioridad,
          recurrencia: values.recurrencia?.trim() || undefined,
        });
        toast.success("Programación creada");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isEdit
            ? "No se pudo actualizar la programación"
            : "No se pudo crear la programación",
      );
    }
  });

  const isPending = createProgramacion.isPending || updateProgramacion.isPending;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Editar programación" : "Nueva programación"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Edita los datos de la programación (solo en estado Programada)."
              : "Programa una mantención para un equipo."}
          </SheetDescription>
        </SheetHeader>

        <SheetPanel>
          <form className="space-y-5" id="programacion-form" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="font-medium text-sm">Equipo</label>
              <Controller
                control={control}
                name="equipoId"
                render={({ field }) => (
                  <EquipoSelect
                    disabled={isEdit}
                    onChange={field.onChange}
                    value={field.value}
                  />
                )}
              />
              {errors.equipoId && (
                <p className="text-destructive text-xs">
                  {errors.equipoId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="font-medium text-sm">Plantilla (opcional)</label>
              <Controller
                control={control}
                name="plantillaId"
                render={({ field }) => (
                  <PlantillaSelect
                    onChange={(id) => field.onChange(id ?? "")}
                    value={field.value || null}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="titulo">
                Título
              </label>
              <Input
                id="titulo"
                placeholder="Mantención preventiva"
                {...register("titulo")}
              />
              {errors.titulo && (
                <p className="text-destructive text-xs">{errors.titulo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="descripcion">
                Descripción (opcional)
              </label>
              <Textarea
                id="descripcion"
                placeholder="Detalle de la mantención."
                rows={2}
                {...register("descripcion")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="fechaProgramada">
                  Fecha programada
                </label>
                <Input
                  id="fechaProgramada"
                  type="datetime-local"
                  {...register("fechaProgramada")}
                />
                {errors.fechaProgramada && (
                  <p className="text-destructive text-xs">
                    {errors.fechaProgramada.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="recurrencia">
                  Recurrencia (opcional)
                </label>
                <Input
                  id="recurrencia"
                  placeholder="Cada 250 horas"
                  {...register("recurrencia")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-medium text-sm">Responsable (opcional)</label>
              <Controller
                control={control}
                name="responsableId"
                render={({ field }) => (
                  <ResponsableSelect
                    onChange={(id) => field.onChange(id ?? "")}
                    value={field.value || null}
                  />
                )}
              />
            </div>

            <div className="space-y-3">
              <label className="font-medium text-sm">Prioridad</label>
              <Controller
                control={control}
                name="prioridad"
                render={({ field }) => (
                  <RadioGroup
                    className="grid gap-2 sm:grid-cols-3"
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    {PRIORIDADES.map((p) => (
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary/20 p-3 text-sm transition-colors hover:bg-secondary/40",
                          field.value === p.value &&
                            "border-brand-primary/50 bg-brand-primary/10",
                        )}
                        key={p.value}
                      >
                        <RadioGroupItem value={p.value} />
                        {p.label}
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
          <Button form="programacion-form" loading={isPending} type="submit">
            {isEdit ? "Guardar cambios" : "Crear programación"}
          </Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
