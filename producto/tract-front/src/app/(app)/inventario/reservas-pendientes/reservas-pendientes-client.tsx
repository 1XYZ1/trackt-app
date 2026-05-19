"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Loader2, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/core";
import { AprobarReservaDialog } from "@/components/inventario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  const handleRechazar = (reserva: ReservaRepuesto) => {
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
          Reservas creadas por mecanicos en estado SOLICITADA. Aprobar reserva
          el stock; rechazar la libera.
        </p>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Pendientes ({reservas.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center gap-2 px-5 py-12 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando solicitudes...
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
                icon="wrench"
                message="No hay reservas en estado SOLICITADA."
                title="Sin solicitudes pendientes"
              />
            </div>
          )}

          {!isLoading && !error && reservas.length > 0 && (
            <div className="flex flex-col gap-4 p-4">
              {reservas.map((reserva) => (
                <div
                  className="rounded-lg border border-border/60 bg-secondary/15 p-4"
                  key={reserva.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="warning">SOLICITADA</Badge>
                      <Link
                        className="font-mono text-xs hover:underline"
                        href={`/tickets/${reserva.ticketId}`}
                      >
                        Ticket {reserva.ticketId}
                      </Link>
                      <span className="text-muted-foreground text-xs">
                        {new Date(reserva.createdAt).toLocaleString("es-CL")}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setAprobarTarget(reserva)}
                        size="sm"
                      >
                        <ClipboardCheck />
                        Aprobar
                      </Button>
                      <Button
                        loading={liberar.isPending}
                        onClick={() => handleRechazar(reserva)}
                        size="sm"
                        variant="destructive-outline"
                      >
                        <RotateCcw />
                        Rechazar
                      </Button>
                    </div>
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
                            <td className="py-2 pr-3">
                              {item.repuesto.nombre}
                            </td>
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
              ))}
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
