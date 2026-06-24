"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress";
import { useActualizarChecklist } from "@/hooks/use-tickets";
import type { ChecklistPaso } from "@/lib/api/tickets";
import { cn } from "@/lib/utils";

export type TicketChecklistProps = {
  ticketId: string;
  checklist: ChecklistPaso[];
  // Si false, el checklist se muestra de solo lectura (sin marcar pasos).
  canEdit: boolean;
};

/**
 * Checklist de mantención del ticket (proveniente de la plantilla). Renderiza
 * los pasos con checkboxes; cuando canEdit, marcar un paso persiste el checklist
 * completo vía PATCH /tickets/:id/checklist. No se muestra si el ticket no tiene
 * checklist (tickets sin plantilla).
 */
export function TicketChecklist({
  canEdit,
  checklist,
  ticketId,
}: TicketChecklistProps) {
  // Estado local para feedback inmediato al marcar; se sincroniza cuando el
  // servidor devuelve el checklist actualizado (o al recargar el ticket).
  const [pasos, setPasos] = useState<ChecklistPaso[]>(checklist);
  const [checklistPrevio, setChecklistPrevio] = useState(checklist);
  const actualizar = useActualizarChecklist(ticketId);

  // Sincroniza con el checklist del servidor sin efecto: patrón recomendado de
  // ajuste de estado durante el render cuando cambia la prop de entrada.
  if (checklist !== checklistPrevio) {
    setChecklistPrevio(checklist);
    setPasos(checklist);
  }

  if (checklist.length === 0) return null;

  const completados = pasos.filter((p) => p.hecho).length;
  const total = pasos.length;
  const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0;

  const toggle = (index: number, hecho: boolean) => {
    const previo = pasos;
    const siguiente = pasos.map((p, i) => (i === index ? { ...p, hecho } : p));
    setPasos(siguiente); // optimista
    actualizar.mutate(siguiente, {
      onError: (error) => {
        setPasos(previo); // rollback
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el checklist",
        );
      },
    });
  };

  return (
    <Card className="rounded-lg border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="size-4 text-muted-foreground" />
          Checklist de mantención
        </CardTitle>
        <div className="flex items-center gap-3">
          <Progress className="flex-1" max={100} value={porcentaje}>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {completados}/{total}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {pasos.map((paso, index) => {
          const id = `checklist-${ticketId}-${index}`;
          return (
            <label
              className={cn(
                "flex items-start gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                canEdit && "cursor-pointer hover:bg-secondary/40",
              )}
              htmlFor={id}
              key={id}
            >
              <Checkbox
                checked={paso.hecho}
                className="mt-0.5"
                disabled={!canEdit || actualizar.isPending}
                id={id}
                onCheckedChange={(checked) => toggle(index, checked === true)}
              />
              <span
                className={cn(
                  "min-w-0 flex-1",
                  paso.hecho && "text-muted-foreground line-through",
                )}
              >
                {paso.paso}
              </span>
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
}
