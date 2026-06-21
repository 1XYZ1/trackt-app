"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  FileText,
  Plus,
  Ticket,
  User,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  DetailBreadcrumb,
  EmptyState,
  StatusBadge,
  TicketCard,
} from "@/components/core";
import { CrearTicketSheet } from "@/components/tickets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrden } from "@/hooks/use-ordenes";
import { descargarPdfOrden } from "@/lib/api/ordenes";

export function OrdenDetalleClient({ id }: { id: string }) {
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const { data: orden, error, isLoading } = useOrden(id);

  const handlePdf = async () => {
    setPdfLoading(true);
    try {
      await descargarPdfOrden(id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo generar el PDF",
      );
    } finally {
      setPdfLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-40" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !orden) {
    return (
      <div className="flex flex-col gap-4">
        <Button render={<Link href="/ordenes" />} size="sm" variant="ghost">
          <ArrowLeft />
          Volver a órdenes
        </Button>
        <Card>
          <CardContent className="p-5">
            <EmptyState
              icon="clipboard"
              message="No se pudo cargar el detalle de la orden de trabajo desde la API."
              title="Error al cargar OT"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const equipoLabel = orden.equipo
    ? `${orden.equipo.codigo} - ${orden.equipo.nombre}`
    : orden.equipoId;
  const ticketsCount = orden.tickets?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <DetailBreadcrumb
            current={orden.codigo}
            parentHref="/ordenes"
            parentLabel="Órdenes"
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h1 className="font-mono font-semibold text-2xl tracking-tight">
              {orden.codigo}
            </h1>
            <StatusBadge estado={orden.estado} />
            <Badge variant={orden.prioridad === "ALTA" ? "error" : "secondary"}>
              Prioridad {orden.prioridad.toLowerCase()}
            </Badge>
          </div>
          <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
            Detalle de orden de trabajo y seguimiento de tickets derivados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            loading={pdfLoading}
            onClick={handlePdf}
            size="sm"
            variant="outline"
          >
            <FileText />
            Descargar PDF
          </Button>
          <Button onClick={() => setCreateTicketOpen(true)} size="sm">
            <Plus />
            Crear ticket
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-brand-primary" />
              Información de OT
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
                Descripción
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
                {orden.descripcion}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoTile
                icon={<Wrench className="size-3.5" />}
                label="Equipo"
                value={
                  orden.equipo ? (
                    <Link
                      className="text-brand-primary hover:underline focus-visible:underline focus-visible:outline-none"
                      href={`/equipos/${orden.equipo.id}`}
                    >
                      {equipoLabel}
                    </Link>
                  ) : (
                    equipoLabel
                  )
                }
              />
              <InfoTile
                icon={<Calendar className="size-3.5" />}
                label="Fecha de creación"
                value={new Date(orden.createdAt).toLocaleDateString("es-CL", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              />
              <InfoTile
                className="sm:col-span-2"
                icon={<User className="size-3.5" />}
                label="Responsable"
                value={
                  orden.responsable?.nombre ||
                  orden.responsable?.email ||
                  "Sin responsable asignado"
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between border-border/50 border-b pb-3 text-sm">
              <span className="text-muted-foreground">Estado</span>
              <StatusBadge estado={orden.estado} showIcon={false} />
            </div>
            <div className="flex items-center justify-between border-border/50 border-b pb-3 text-sm">
              <span className="text-muted-foreground">Prioridad</span>
              <Badge
                variant={orden.prioridad === "ALTA" ? "error" : "secondary"}
              >
                {orden.prioridad}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tickets derivados</span>
              <span className="inline-flex items-center gap-1.5 font-mono font-semibold">
                <Ticket className="size-3.5 text-muted-foreground" />
                {ticketsCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            Tickets derivados
            {ticketsCount > 0 && (
              <Badge variant="secondary">{ticketsCount}</Badge>
            )}
          </CardTitle>
          <Button
            onClick={() => setCreateTicketOpen(true)}
            size="sm"
            variant="ghost"
          >
            <Plus />
            Agregar
          </Button>
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
              message="Esta OT aún no tiene tickets derivados. Crea uno para asignar trabajo a un mecánico."
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

function InfoTile({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border/50 bg-secondary/20 p-3 ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-medium text-sm">{value}</div>
    </div>
  );
}
