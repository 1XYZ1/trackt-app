"use client";

import { useDraggable } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { TicketCard, type TicketEstado } from "@/components/core";
import { usePrefetchTicket } from "@/hooks/use-tickets";
import {
  getTicketEquipoLabel,
  type TicketTrabajo,
} from "@/lib/api/tickets";
import { cn } from "@/lib/utils";

function toResumen(ticket: TicketTrabajo) {
  return {
    codigo: ticket.codigo,
    equipo: getTicketEquipoLabel(ticket),
    estado: ticket.estado as TicketEstado,
    mecanico: ticket.mecanico,
    titulo: ticket.titulo,
  };
}

/**
 * Card arrastrable del kanban. Si `draggable` es false (sin transiciones válidas
 * para el usuario), no registra listeners de drag y solo navega al detalle.
 * Un click sin movimiento navega (activationConstraint distance:8 en el sensor).
 */
export function KanbanCard({
  ticket,
  draggable,
}: {
  ticket: TicketTrabajo;
  draggable: boolean;
}) {
  const router = useRouter();
  const prefetch = usePrefetchTicket();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ticket.id,
    data: { ticket },
    disabled: !draggable,
  });

  return (
    <div
      className={cn(
        "rounded-lg",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
      onClick={() => router.push(`/tickets/${ticket.id}`)}
      onMouseEnter={() => prefetch(ticket.id)}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
    >
      <TicketCard
        className="transition-colors hover:border-brand-primary/40"
        ticket={toResumen(ticket)}
      />
    </div>
  );
}
