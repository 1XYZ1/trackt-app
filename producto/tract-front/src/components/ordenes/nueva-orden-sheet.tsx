"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { EquipoSelect } from "@/components/equipos";
import { Button } from "@/components/ui/button";
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
import { useCreateOrden } from "@/hooks/use-ordenes";
import type { OrdenPrioridad } from "@/lib/api/ordenes";
import { cn } from "@/lib/utils";

const nuevaOrdenSchema = z.object({
  descripcion: z
    .string()
    .min(5, "La descripcion debe tener al menos 5 caracteres"),
  equipoId: z.string().min(1, "Selecciona un equipo"),
  prioridad: z.enum(["BAJA", "MEDIA", "ALTA"]),
});

type NuevaOrdenFormValues = z.infer<typeof nuevaOrdenSchema>;

const prioridades: {
  description: string;
  label: string;
  value: OrdenPrioridad;
}[] = [
  {
    description: "Seguimiento normal de mantencion.",
    label: "Baja",
    value: "BAJA",
  },
  {
    description: "Prioridad operativa estandar.",
    label: "Media",
    value: "MEDIA",
  },
  {
    description: "Riesgo operacional o detencion.",
    label: "Alta",
    value: "ALTA",
  },
];

export type NuevaOrdenSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NuevaOrdenSheet({ onOpenChange, open }: NuevaOrdenSheetProps) {
  const router = useRouter();
  const createOrden = useCreateOrden();
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<NuevaOrdenFormValues>({
    defaultValues: {
      descripcion: "",
      equipoId: "",
      prioridad: "MEDIA",
    },
    resolver: zodResolver(nuevaOrdenSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const orden = await createOrden.mutateAsync(values);
      toast.success("Orden de trabajo creada");
      reset();
      onOpenChange(false);
      router.push(`/ordenes/${orden.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo crear la orden de trabajo",
      );
    }
  });

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="max-w-xl">
        <SheetHeader>
          <SheetTitle>Nueva OT</SheetTitle>
          <SheetDescription>
            Crea una orden de trabajo asociada a un equipo operacional.
          </SheetDescription>
        </SheetHeader>

        <SheetPanel>
          <form className="space-y-5" id="nueva-ot-form" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="font-medium text-sm">Equipo</label>
              <Controller
                control={control}
                name="equipoId"
                render={({ field }) => (
                  <EquipoSelect
                    disabled={createOrden.isPending}
                    onChange={field.onChange}
                    placeholder="Seleccionar equipo"
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
              <label className="font-medium text-sm" htmlFor="descripcion">
                Descripcion
              </label>
              <Textarea
                id="descripcion"
                placeholder="Describe la solicitud de mantencion, falla o trabajo requerido."
                {...register("descripcion")}
              />
              {errors.descripcion && (
                <p className="text-destructive text-xs">
                  {errors.descripcion.message}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <label className="font-medium text-sm">Prioridad</label>
              <Controller
                control={control}
                name="prioridad"
                render={({ field }) => (
                  <RadioGroup
                    className="grid gap-2"
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    {prioridades.map((prioridad) => (
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3 transition-colors hover:bg-secondary/40",
                          field.value === prioridad.value &&
                            "border-brand-primary/50 bg-brand-primary/10",
                        )}
                        key={prioridad.value}
                      >
                        <RadioGroupItem className="mt-0.5" value={prioridad.value} />
                        <span>
                          <span className="block font-medium text-sm">
                            {prioridad.label}
                          </span>
                          <span className="block text-muted-foreground text-xs">
                            {prioridad.description}
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
          <Button form="nueva-ot-form" loading={createOrden.isPending} type="submit">
            Crear OT
          </Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
