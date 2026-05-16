"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { Input } from "@/components/ui/input";
import { useCreateTicketFromOrden } from "@/hooks/use-tickets";
import type { TicketPrioridad } from "@/lib/api/tickets";
import { cn } from "@/lib/utils";

const crearTicketSchema = z.object({
  descripcion: z
    .string()
    .min(5, "La descripcion debe tener al menos 5 caracteres"),
  prioridad: z.enum(["BAJA", "MEDIA", "ALTA"]),
  titulo: z.string().min(3, "El titulo debe tener al menos 3 caracteres"),
});

type CrearTicketFormValues = z.infer<typeof crearTicketSchema>;

const prioridades: {
  description: string;
  label: string;
  value: TicketPrioridad;
}[] = [
  {
    description: "Trabajo sin impacto operacional inmediato.",
    label: "Baja",
    value: "BAJA",
  },
  {
    description: "Requiere seguimiento normal del taller.",
    label: "Media",
    value: "MEDIA",
  },
  {
    description: "Riesgo de detencion o impacto operacional.",
    label: "Alta",
    value: "ALTA",
  },
];

export type CrearTicketSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordenId: string;
};

export function CrearTicketSheet({
  onOpenChange,
  open,
  ordenId,
}: CrearTicketSheetProps) {
  const router = useRouter();
  const createTicket = useCreateTicketFromOrden(ordenId);
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<CrearTicketFormValues>({
    defaultValues: {
      descripcion: "",
      prioridad: "MEDIA",
      titulo: "",
    },
    resolver: zodResolver(crearTicketSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const ticket = await createTicket.mutateAsync(values);
      toast.success("Ticket creado desde OT");
      reset();
      onOpenChange(false);
      router.push(`/tickets/${ticket.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo crear el ticket",
      );
    }
  });

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="max-w-xl">
        <SheetHeader>
          <SheetTitle>Crear ticket desde OT</SheetTitle>
          <SheetDescription>
            Registra el trabajo que debe ejecutar el taller sobre esta orden.
          </SheetDescription>
        </SheetHeader>

        <SheetPanel>
          <form className="space-y-5" id="crear-ticket-form" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="titulo">
                Titulo
              </label>
              <Input
                id="titulo"
                placeholder="Ej: Revisar fuga hidraulica"
                {...register("titulo")}
              />
              {errors.titulo && (
                <p className="text-destructive text-xs">{errors.titulo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="descripcion">
                Descripcion
              </label>
              <Textarea
                id="descripcion"
                placeholder="Describe el trabajo requerido para el mecanico."
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
          <Button
            form="crear-ticket-form"
            loading={createTicket.isPending}
            type="submit"
          >
            Crear ticket
          </Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
