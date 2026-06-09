"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import {
  TicketCard,
  ticketEstadoLabel,
  type TicketEstado,
} from "@/components/core";
import { useAuth } from "@/contexts/auth-context";
import { useIniciarTicketKanban } from "@/hooks/use-tickets";
import { getTicketEquipoLabel, type TicketTrabajo } from "@/lib/api/tickets";
import {
  getTransition,
  getValidTargets,
  canDrag,
  type TransitionAction,
} from "@/lib/tickets/transitions";
import { AsignarMecanicoDialog } from "../asignar-mecanico-dialog";
import { FinalizarTicketDialog } from "../finalizar-ticket-dialog";
import { ValidarTicketDialog } from "../validar-ticket-dialog";
import { KanbanCard } from "./kanban-card";
import { KanbanColumn } from "./kanban-column";

// Columnas visibles del kanban: el workflow abierto + CERRADO. CANCELADO no es
// columna (se ve en la vista lista / filtros).
const COLUMNAS: TicketEstado[] = [
  "PENDIENTE",
  "ASIGNADO",
  "EN_EJECUCION",
  "EJECUTADO",
  "CERRADO",
];

// Tope de cards renderizadas en CERRADO para no inflar el DOM; el header muestra
// el total real.
const CERRADO_CAP = 20;

type PendingDrop = { ticketId: string; action: TransitionAction };

export function TicketsKanban({ tickets }: { tickets: TicketTrabajo[] }) {
  const { id: userId, role } = useAuth();
  const iniciar = useIniciarTicketKanban();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDrop | null>(null);

  const sensors = useSensors(
    // distance:8 evita que un click (navegar al detalle) inicie un drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const buckets = useMemo(() => {
    const map = new Map<TicketEstado, TicketTrabajo[]>();
    for (const estado of COLUMNAS) map.set(estado, []);
    for (const ticket of tickets) {
      map.get(ticket.estado)?.push(ticket);
    }
    return map;
  }, [tickets]);

  const activeTicket = activeId
    ? tickets.find((t) => t.id === activeId) ?? null
    : null;

  const validTargets =
    activeTicket && getValidTargets(activeTicket, role, userId);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const ticket = activeTicket;
    setActiveId(null);
    if (!ticket || !event.over) return;

    const to = event.over.id as TicketEstado;
    const transition = getTransition(ticket, to, role, userId);
    if (!transition) return; // destino inválido o sin permiso → no-op

    if (transition.action === "iniciar") {
      iniciar.mutate(ticket.id);
      return;
    }
    setPending({ ticketId: ticket.id, action: transition.action });
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const t = tickets.find((x) => x.id === active.id);
      return `Tomaste el ticket ${t?.codigo ?? ""}.`;
    },
    onDragOver: ({ over }) =>
      over
        ? `Sobre la columna ${ticketEstadoLabel(over.id as TicketEstado)}.`
        : "Fuera de las columnas.",
    onDragEnd: ({ over }) =>
      over
        ? `Soltaste en ${ticketEstadoLabel(over.id as TicketEstado)}.`
        : "Cancelado, el ticket vuelve a su columna.",
    onDragCancel: () => "Movimiento cancelado.",
  };

  return (
    <>
      <DndContext
        accessibility={{ announcements }}
        collisionDetection={pointerWithin}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNAS.map((estado) => {
            const items = buckets.get(estado) ?? [];
            const visibles =
              estado === "CERRADO" ? items.slice(0, CERRADO_CAP) : items;
            // Durante un drag: atenuar columnas que no son destino válido ni la
            // columna de origen (soltar en origen = no-op permitido).
            const isDimmed = Boolean(
              activeTicket &&
                estado !== activeTicket.estado &&
                !validTargets?.includes(estado),
            );

            return (
              <KanbanColumn
                count={items.length}
                dimmed={isDimmed}
                disabled={isDimmed}
                estado={estado}
                key={estado}
              >
                {visibles.map((ticket) => (
                  <KanbanCard
                    draggable={canDrag(ticket, role, userId)}
                    key={ticket.id}
                    ticket={ticket}
                  />
                ))}
                {estado === "CERRADO" && items.length > CERRADO_CAP && (
                  <p className="px-1 py-2 text-center text-muted-foreground text-xs">
                    +{items.length - CERRADO_CAP} más
                  </p>
                )}
              </KanbanColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeTicket && (
            <div className="rotate-2 cursor-grabbing">
              <TicketCard
                className="shadow-lg"
                ticket={{
                  codigo: activeTicket.codigo,
                  equipo: getTicketEquipoLabel(activeTicket),
                  estado: activeTicket.estado,
                  mecanico: activeTicket.mecanico,
                  titulo: activeTicket.titulo,
                }}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Dialogs disparados al soltar en una transición que requiere payload. */}
      {pending?.action === "asignar" && (
        <AsignarMecanicoDialog
          onOpenChange={(open) => !open && setPending(null)}
          open
          ticketId={pending.ticketId}
        />
      )}
      {pending?.action === "finalizar" && (
        <FinalizarTicketDialog
          onOpenChange={(open) => !open && setPending(null)}
          open
          ticketId={pending.ticketId}
        />
      )}
      {pending?.action === "validar_aprobar" && (
        <ValidarTicketDialog
          mode="aprobar"
          onOpenChange={(open) => !open && setPending(null)}
          open
          ticketId={pending.ticketId}
        />
      )}
      {pending?.action === "validar_rechazar" && (
        <ValidarTicketDialog
          mode="rechazar"
          onOpenChange={(open) => !open && setPending(null)}
          open
          ticketId={pending.ticketId}
        />
      )}
    </>
  );
}
