"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Package, Ticket, X } from "lucide-react";
import { EmptyState } from "@/components/core";
import {
  AprobarReservaDialog,
  ReservaEstadoBadge,
} from "@/components/inventario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useLiberarReserva,
  useReservasPendientes,
} from "@/hooks/use-inventario";
import type { ReservaRepuesto } from "@/lib/api/inventario";

export function ReservasPendientesClient() {
  const { data: reservas = [], error, isLoading } = useReservasPendientes();
  const liberar = useLiberarReserva();
  const [aprobarTarget, setAprobarTarget] = useState<ReservaRepuesto | null>(
    null,
  );
  // Id de la reserva que se está rechazando, para que solo gire su botón.
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);

  const handleRechazar = (reserva: ReservaRepuesto) => {
    setRechazandoId(reserva.id);
    liberar.mutate(
      { id: reserva.id },
      {
        onSuccess: () => toast.success("Solicitud rechazada"),
        onError: (err) =>
          toast.error(
            err instanceof Error
              ? err.message
              : "No se pudo rechazar la solicitud",
          ),
        onSettled: () => setRechazandoId(null),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
          <ClipboardCheck className="size-3.5" />
          Aprobaciones de inventario
        </div>
        <h1 className="font-semibold text-2xl tracking-tight">
          Solicitudes pendientes
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
          Reservas creadas por mecánicos en estado Solicitada. Aprobar aparta el
          stock disponible; rechazar libera la solicitud sin afectar el
          inventario.
        </p>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Por aprobar</CardTitle>
            <p className="text-muted-foreground text-xs">
              Solicitudes que esperan tu revisión.
            </p>
          </div>
          {reservas.length > 0 && (
            <Badge variant="warning">
              {reservas.length} pendiente{reservas.length === 1 ? "" : "s"}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex flex-col gap-4 p-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  className="space-y-3 rounded-lg border border-border/60 p-4"
                  key={idx}
                >
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="ml-auto h-8 w-40" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="No se pudieron cargar las solicitudes pendientes."
                title="Error al cargar"
              />
            </div>
          )}

          {!isLoading && !error && reservas.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon="clipboard"
                message="No hay reservas esperando aprobación. Todo al día."
                title="Sin solicitudes pendientes"
              />
            </div>
          )}

          {!isLoading && !error && reservas.length > 0 && (
            <div className="flex flex-col gap-4 p-4">
              {reservas.map((reserva) => {
                const totalUnidades = reserva.items.reduce(
                  (acc, it) => acc + it.cantidad,
                  0,
                );
                const rechazando =
                  liberar.isPending && rechazandoId === reserva.id;
                return (
                  <div
                    className="rounded-lg border border-border/60 bg-secondary/15 p-4 transition-colors hover:border-border"
                    key={reserva.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <ReservaEstadoBadge estado={reserva.estado} />
                        <Link
                          className="flex items-center gap-1 rounded-sm font-mono text-xs outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          href={`/tickets/${reserva.ticketId}`}
                        >
                          <Ticket className="size-3.5 text-muted-foreground" />
                          {reserva.ticketId}
                        </Link>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {new Date(reserva.createdAt).toLocaleString("es-CL")}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          disabled={rechazando}
                          onClick={() => setAprobarTarget(reserva)}
                          size="sm"
                        >
                          <ClipboardCheck />
                          Aprobar
                        </Button>
                        <Button
                          loading={rechazando}
                          onClick={() => handleRechazar(reserva)}
                          size="sm"
                          variant="destructive-outline"
                        >
                          <X />
                          Rechazar
                        </Button>
                      </div>
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
                              <td className="px-3 py-2">
                                {item.repuesto.nombre}
                              </td>
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
        </CardContent>
      </Card>

      <AprobarReservaDialog
        onOpenChange={(open) => {
          if (!open) setAprobarTarget(null);
        }}
        open={Boolean(aprobarTarget)}
        reserva={aprobarTarget}
      />
    </div>
  );
}
