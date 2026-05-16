"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  Loader2,
  Plus,
  User,
  Wrench,
} from "lucide-react";
import { EmptyState, StatusBadge, TicketCard } from "@/components/core";
import { CrearTicketSheet } from "@/components/tickets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrden } from "@/hooks/use-ordenes";

export function OrdenDetalleClient({ id }: { id: string }) {
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const { data: orden, error, isLoading } = useOrden(id);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Cargando detalle de OT...
      </div>
    );
  }

  if (error || !orden) {
    return (
      <EmptyState
        icon="clipboard"
        message="No se pudo cargar el detalle de la orden de trabajo desde la API."
        title="Error al cargar OT"
      />
    );
  }

  const equipoLabel = orden.equipo
    ? `${orden.equipo.codigo} - ${orden.equipo.nombre}`
    : orden.equipoId;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Button render={<Link href="/ordenes" />} size="sm" variant="ghost">
            <ArrowLeft />
            Volver a ordenes
          </Button>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h1 className="font-semibold text-2xl tracking-tight">
              {orden.codigo}
            </h1>
            <StatusBadge estado={orden.estado} />
            <Badge variant={orden.prioridad === "ALTA" ? "error" : "secondary"}>
              {orden.prioridad}
            </Badge>
          </div>
          <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
            Detalle de orden de trabajo y seguimiento de tickets derivados.
          </p>
        </div>
        <Button
          onClick={() => setCreateTicketOpen(true)}
          size="sm"
          variant="outline"
        >
          <Plus />
          Crear ticket desde esta OT
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-lg border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-brand-primary" />
              Informacion de OT
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium text-muted-foreground text-xs uppercase">
                Descripcion
              </p>
              <p className="mt-1 text-sm">{orden.descripcion}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Wrench className="size-3.5" />
                  Equipo
                </div>
                <p className="mt-1 font-medium text-sm">{equipoLabel}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Calendar className="size-3.5" />
                  Fecha de creacion
                </div>
                <p className="mt-1 font-medium text-sm">
                  {new Date(orden.createdAt).toLocaleDateString("es-CL")}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <User className="size-3.5" />
                  Responsable
                </div>
                <p className="mt-1 font-medium text-sm">
                  {orden.responsable?.nombre ||
                    orden.responsable?.email ||
                    "Sin responsable asignado"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between border-border/50 border-b pb-2 text-sm">
              <span className="text-muted-foreground">Estado</span>
              <StatusBadge estado={orden.estado} showIcon={false} />
            </div>
            <div className="flex justify-between border-border/50 border-b pb-2 text-sm">
              <span className="text-muted-foreground">Prioridad</span>
              <span className="font-medium">{orden.prioridad}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tickets derivados</span>
              <span className="font-mono font-semibold">
                {orden.tickets?.length ?? 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Tickets derivados</CardTitle>
        </CardHeader>
        <CardContent>
          {orden.tickets && orden.tickets.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {orden.tickets.map((ticket) => (
                <TicketCard key={ticket.codigo} ticket={ticket} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="ticket"
              message="Esta OT aun no tiene tickets derivados."
              title="Sin tickets derivados"
            />
          )}
        </CardContent>
      </Card>

      <CrearTicketSheet
        onOpenChange={setCreateTicketOpen}
        open={createTicketOpen}
        ordenId={orden.id}
      />
    </div>
  );
}
