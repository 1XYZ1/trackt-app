"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardCheck,
  Package,
  PackageOpen,
  PackagePlus,
  RotateCcw,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/core";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasRole, useAuth } from "@/contexts/auth-context";
import {
  useConsumirReserva,
  useLiberarReserva,
  useReservasByTicket,
} from "@/hooks/use-inventario";
import type { ReservaRepuesto } from "@/lib/api/inventario";
import { AprobarReservaDialog } from "./aprobar-reserva-dialog";
import { ReservaEstadoBadge } from "./inventario-ui";
import { NuevaReservaDialog } from "./nueva-reserva-dialog";

interface Props {
  ticketId: string;
  ticketEstado: string;
  ticketMecanicoId?: string | null;
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
  const isJefeInventario = useHasRole("jefe_inventario");
  // Gestores de inventario que aprueban/rechazan/operan reservas.
  const canManageReserva = isAdmin || isJefe || isJefeInventario;

  // Mechanic solo puede operar reservas si el ticket le pertenece.
  const isOwnerMechanic =
    role === "mechanic" && ticketMecanicoId === auth.id;
  const canCreate =
    (canManageReserva || isOwnerMechanic) &&
    !TICKET_FINALES.includes(ticketEstado);
  const canModifyReserva = canManageReserva || isOwnerMechanic;

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
          <div className="flex flex-col gap-4">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div
                className="space-y-3 rounded-lg border border-border/60 p-4"
                key={idx}
              >
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
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
            icon="inbox"
            message="Aún no hay repuestos reservados para este ticket."
            title="Sin reservas"
          />
        )}

        {!isLoading && !error && reservas.length > 0 && (
          <div className="flex flex-col gap-4">
            {reservas.map((reserva) => {
              const canActOnReservada =
                canModifyReserva && reserva.estado === "RESERVADA";
              // Solo gestores de inventario pueden aprobar (mechanic ve
              // SOLICITADA read-only).
              const canAprobar =
                canManageReserva && reserva.estado === "SOLICITADA";
              // Liberar tambien funciona para SOLICITADA (cancela la solicitud).
              const canLiberarSolicitada =
                canModifyReserva && reserva.estado === "SOLICITADA";
              const totalUnidades = reserva.items.reduce(
                (acc, it) => acc + it.cantidad,
                0,
              );
              return (
                <div
                  className="rounded-lg border border-border/60 bg-secondary/15 p-4 transition-colors hover:border-border"
                  key={reserva.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <ReservaEstadoBadge estado={reserva.estado} />
                      <span className="text-muted-foreground text-xs tabular-nums">
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
                            <X />
                            Rechazar
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
                    <span className="flex items-center gap-1.5">
                      <Package className="size-3.5" />
                      {reserva.items.length} repuesto
                      {reserva.items.length === 1 ? "" : "s"}
                    </span>
                    <span>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {totalUnidades}
                      </span>{" "}
                      unidad{totalUnidades === 1 ? "" : "es"} en total
                    </span>
                  </div>

                  {reserva.observacion && (
                    <p className="mt-2 rounded-md bg-background/60 px-3 py-2 text-muted-foreground text-xs">
                      {reserva.observacion}
                    </p>
                  )}

                  <div className="mt-3 overflow-x-auto rounded-md border border-border/50">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-border/60 border-b bg-background/40 text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                          <th className="px-3 py-2 font-semibold">Código</th>
                          <th className="px-3 py-2 font-semibold">Nombre</th>
                          <th className="px-3 py-2 text-right font-semibold">
                            Cantidad
                          </th>
                          <th className="px-3 py-2 font-semibold">Unidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reserva.items.map((item) => (
                          <tr
                            className="border-border/40 border-b last:border-0"
                            key={item.id}
                          >
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                              {item.repuesto.codigo}
                            </td>
                            <td className="px-3 py-2">{item.repuesto.nombre}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                              {item.cantidad}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">
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
      {canManageReserva && (
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
