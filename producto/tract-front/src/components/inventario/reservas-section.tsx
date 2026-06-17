"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  PackageOpen,
  PackagePlus,
  RotateCcw,
} from "lucide-react";
import { EmptyState } from "@/components/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useHasRole, useAuth } from "@/contexts/auth-context";
import {
  useConsumirReserva,
  useLiberarReserva,
  useReservasByTicket,
} from "@/hooks/use-inventario";
import type { ReservaEstado, ReservaRepuesto } from "@/lib/api/inventario";
import { AprobarReservaDialog } from "./aprobar-reserva-dialog";
import { NuevaReservaDialog } from "./nueva-reserva-dialog";

interface Props {
  ticketId: string;
  ticketEstado: string;
  ticketMecanicoId?: string | null;
}

function estadoBadgeVariant(
  estado: ReservaEstado,
): "default" | "secondary" | "outline" | "error" | "warning" {
  switch (estado) {
    case "SOLICITADA":
      return "warning";
    case "RESERVADA":
      return "default";
    case "CONSUMIDA":
      return "secondary";
    case "LIBERADA":
      return "outline";
    case "CANCELADA":
      return "error";
    default:
      return "secondary";
  }
}

// Estados terminales del ticket que bloquean crear nuevas reservas.
const TICKET_FINALES = ["EJECUTADO", "CERRADO", "CANCELADO"];

export function ReservasSection({
  ticketEstado,
  ticketId,
  ticketMecanicoId,
}: Props) {
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [aprobarTarget, setAprobarTarget] = useState<ReservaRepuesto | null>(
    null,
  );
  const auth = useAuth();
  const role = auth.role;
  const isAdmin = useHasRole("admin");
  const isJefe = useHasRole("jefe_taller");

  // Mechanic solo puede operar reservas si el ticket le pertenece.
  const isOwnerMechanic =
    role === "mechanic" && ticketMecanicoId === auth.id;
  const canCreate =
    (isAdmin || isJefe || isOwnerMechanic) &&
    !TICKET_FINALES.includes(ticketEstado);
  const canModifyReserva = isAdmin || isJefe || isOwnerMechanic;

  const { data: reservas = [], error, isLoading } = useReservasByTicket(ticketId);
  const liberar = useLiberarReserva(ticketId);
  const consumir = useConsumirReserva(ticketId);

  const handleLiberar = (reserva: ReservaRepuesto) => {
    liberar.mutate(
      { id: reserva.id },
      {
        onSuccess: () => toast.success("Reserva liberada"),
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "No se pudo liberar la reserva",
          ),
      },
    );
  };

  const handleConsumir = (reserva: ReservaRepuesto) => {
    consumir.mutate(
      { id: reserva.id },
      {
        onSuccess: () => toast.success("Reserva consumida"),
        onError: (err) =>
          toast.error(
            err instanceof Error
              ? err.message
              : "No se pudo consumir la reserva",
          ),
      },
    );
  };

  return (
    <Card className="rounded-lg border-border/70">
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Reservas de repuestos</CardTitle>
          <p className="text-muted-foreground text-xs">
            Repuestos apartados desde el inventario para este ticket.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setNuevaOpen(true)} size="sm">
            <PackagePlus />
            Reservar repuestos
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Cargando reservas...
          </div>
        )}

        {!isLoading && error && (
          <EmptyState
            icon="wrench"
            message="No se pudieron cargar las reservas del ticket."
            title="Error al cargar reservas"
          />
        )}

        {!isLoading && !error && reservas.length === 0 && (
          <EmptyState
            icon="wrench"
            message="Aun no hay repuestos reservados para este ticket."
            title="Sin reservas"
          />
        )}

        {!isLoading && !error && reservas.length > 0 && (
          <div className="flex flex-col gap-4">
            {reservas.map((reserva) => {
              const canActOnReservada =
                canModifyReserva && reserva.estado === "RESERVADA";
              // Solo admin/jefe pueden aprobar (mechanic ve SOLICITADA read-only).
              const canAprobar =
                (isAdmin || isJefe) && reserva.estado === "SOLICITADA";
              // Liberar tambien funciona para SOLICITADA (cancela la solicitud).
              const canLiberarSolicitada =
                canModifyReserva && reserva.estado === "SOLICITADA";
              return (
                <div
                  className="rounded-lg border border-border/60 bg-secondary/15 p-4"
                  key={reserva.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={estadoBadgeVariant(reserva.estado)}>
                        {reserva.estado}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {new Date(reserva.createdAt).toLocaleString("es-CL")}
                      </span>
                    </div>
                    {canActOnReservada && (
                      <div className="flex gap-2">
                        <Button
                          loading={consumir.isPending}
                          onClick={() => handleConsumir(reserva)}
                          size="sm"
                          variant="default"
                        >
                          <CheckCircle2 />
                          Consumir
                        </Button>
                        <Button
                          loading={liberar.isPending}
                          onClick={() => handleLiberar(reserva)}
                          size="sm"
                          variant="destructive-outline"
                        >
                          <RotateCcw />
                          Liberar
                        </Button>
                      </div>
                    )}
                    {(canAprobar || canLiberarSolicitada) && (
                      <div className="flex gap-2">
                        {canAprobar && (
                          <Button
                            onClick={() => setAprobarTarget(reserva)}
                            size="sm"
                            variant="default"
                          >
                            <ClipboardCheck />
                            Aprobar
                          </Button>
                        )}
                        {canLiberarSolicitada && (
                          <Button
                            loading={liberar.isPending}
                            onClick={() => handleLiberar(reserva)}
                            size="sm"
                            variant="destructive-outline"
                          >
                            <RotateCcw />
                            Rechazar
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {reserva.observacion && (
                    <p className="mt-2 text-muted-foreground text-xs">
                      {reserva.observacion}
                    </p>
                  )}

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                          <th className="py-2 pr-3 font-semibold">Codigo</th>
                          <th className="py-2 pr-3 font-semibold">Nombre</th>
                          <th className="py-2 pr-3 text-right font-semibold">
                            Cantidad
                          </th>
                          <th className="py-2 font-semibold">Unidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reserva.items.map((item) => (
                          <tr
                            className="border-border/40 border-b last:border-0"
                            key={item.id}
                          >
                            <td className="whitespace-nowrap py-2 pr-3 font-mono text-xs">
                              {item.repuesto.codigo}
                            </td>
                            <td className="py-2 pr-3">{item.repuesto.nombre}</td>
                            <td className="py-2 pr-3 text-right font-mono text-xs">
                              {item.cantidad}
                            </td>
                            <td className="py-2 text-muted-foreground text-xs">
                              {item.repuesto.unidad}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!canCreate && reservas.length === 0 && !isLoading && (
          <div className="mt-3 flex items-center gap-2 text-muted-foreground text-xs">
            <PackageOpen className="size-3.5" />
            {TICKET_FINALES.includes(ticketEstado)
              ? "No se pueden crear reservas en este estado del ticket."
              : "No tienes permisos para reservar repuestos en este ticket."}
          </div>
        )}
      </CardContent>

      {canCreate && (
        <NuevaReservaDialog
          onOpenChange={setNuevaOpen}
          open={nuevaOpen}
          ticketId={ticketId}
        />
      )}
      {(isAdmin || isJefe) && (
        <AprobarReservaDialog
          onOpenChange={(open) => {
            if (!open) setAprobarTarget(null);
          }}
          open={Boolean(aprobarTarget)}
          reserva={aprobarTarget}
        />
      )}
    </Card>
  );
}
