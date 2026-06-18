"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ImageOff,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState, StatusBadge } from "@/components/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useFinalizarEjecucion,
  useMiTicket,
  useSubirEvidencia,
} from "@/hooks/use-mis-tickets";
import type { TicketEvidence } from "@/lib/api/mis-tickets";
import { PRIORIDAD_DOT, PRIORIDAD_LABEL } from "@/lib/tickets/format";
import { cn } from "@/lib/utils";
import { ReservasSection } from "@/components/inventario/reservas-section";

function getPriorityVariant(priority: "BAJA" | "MEDIA" | "ALTA") {
  if (priority === "ALTA") return "error";
  if (priority === "MEDIA") return "warning";
  return "secondary";
}

function EvidenceGrid({
  evidencias,
  onOpen,
}: {
  evidencias: TicketEvidence[];
  onOpen: (evidencia: TicketEvidence) => void;
}) {
  if (evidencias.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-8 text-center">
        <span className="flex size-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary ring-1 ring-inset ring-brand-primary/20">
          <Camera className="size-5" />
        </span>
        <p className="font-medium text-foreground text-sm">Aún no hay fotos</p>
        <p className="max-w-xs text-muted-foreground text-xs">
          Toma fotos del avance o resultado del trabajo para respaldar el cierre.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {evidencias.map((evidencia) => (
        <button
          className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary/20 outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          key={evidencia.id}
          onClick={() => onOpen(evidencia)}
          type="button"
        >
          {evidencia.url ? (
            <Image
              alt={evidencia.fileName}
              className="size-full object-cover transition group-hover:scale-105"
              height={280}
              src={evidencia.url}
              unoptimized
              width={280}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-6" />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function MiTicketSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}

export function MiTicketDetalleClient({ id }: { id: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [observacion, setObservacion] = useState("");
  const [preview, setPreview] = useState<TicketEvidence | null>(null);
  const { data: ticket, error, isLoading } = useMiTicket(id);
  const uploadEvidence = useSubirEvidencia(id);
  const finishTicket = useFinalizarEjecucion(id);

  const evidencias = useMemo(
    () => ticket?.evidencias ?? [],
    [ticket?.evidencias],
  );
  const evidenciasRef = useRef(evidencias);

  useEffect(() => {
    evidenciasRef.current = evidencias;
  }, [evidencias]);

  useEffect(() => {
    return () => {
      for (const e of evidenciasRef.current) {
        if (e.url?.startsWith("blob:")) URL.revokeObjectURL(e.url);
      }
    };
  }, []);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    for (const file of files) {
      try {
        toast.loading(`Subiendo ${file.name}...`, { id: file.name });
        await uploadEvidence.mutateAsync(file);
        toast.success("Foto subida", { id: file.name });
      } catch (uploadError) {
        toast.error(
          uploadError instanceof Error
            ? uploadError.message
            : "No se pudo subir la foto",
          { id: file.name },
        );
      }
    }

    event.target.value = "";
  }

  async function handleFinish() {
    if (evidencias.length === 0) {
      toast.error("Sube al menos una foto antes de finalizar");
      return;
    }

    try {
      await finishTicket.mutateAsync({ observacion });
      toast.success("Trabajo finalizado");
      setFinishOpen(false);
    } catch (finishError) {
      toast.error(
        finishError instanceof Error
          ? finishError.message
          : "No se pudo finalizar el trabajo",
      );
    }
  }

  if (isLoading) {
    return <MiTicketSkeleton />;
  }

  if (error || !ticket) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Button
          className="w-fit"
          render={<Link href="/mis-tickets" />}
          size="sm"
          variant="ghost"
        >
          <ArrowLeft />
          Volver
        </Button>
        <EmptyState
          icon="ticket"
          message="No se pudo cargar el ticket asignado."
          title="Error al cargar ticket"
        />
      </div>
    );
  }

  const canFinish = evidencias.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-24">
      <Button
        className="w-fit"
        render={<Link href="/mis-tickets" />}
        size="sm"
        variant="ghost"
      >
        <ArrowLeft />
        Volver
      </Button>

      <Card className="rounded-xl border-border/70">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono font-semibold text-muted-foreground text-xs tracking-tight">
                {ticket.codigo}
              </p>
              <h1 className="mt-1 text-balance font-semibold text-2xl leading-tight">
                {ticket.titulo}
              </h1>
            </div>
            <Badge className="gap-1.5" variant={getPriorityVariant(ticket.prioridad)}>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  PRIORIDAD_DOT[ticket.prioridad],
                )}
              />
              {PRIORIDAD_LABEL[ticket.prioridad]}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge estado={ticket.estado} />
            <Badge variant="outline">{ticket.ordenCodigo}</Badge>
          </div>
          <p className="text-pretty text-muted-foreground text-sm">
            {ticket.descripcion}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/70">
        <CardContent className="flex items-start gap-3 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <Wrench className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="font-medium text-sm">Equipo</p>
            <p className="mt-0.5 text-pretty text-muted-foreground text-sm">
              {ticket.equipo}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            Evidencias
            {evidencias.length > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 font-medium text-secondary-foreground text-xs tabular-nums">
                {evidencias.length}
              </span>
            )}
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            Sube fotos del avance o resultado antes de finalizar.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <EvidenceGrid evidencias={evidencias} onOpen={setPreview} />

          <input
            accept="image/*"
            capture="environment"
            className="hidden"
            multiple
            onChange={handleFileChange}
            ref={inputRef}
            type="file"
          />

          <Button
            className="h-12 w-full"
            disabled={uploadEvidence.isPending}
            loading={uploadEvidence.isPending}
            onClick={() => inputRef.current?.click()}
            variant="outline"
          >
            <Camera />
            {evidencias.length > 0 ? "Agregar más fotos" : "Cámara / Galería"}
          </Button>
        </CardContent>
      </Card>

      <ReservasSection
        ticketEstado={ticket.estado}
        ticketId={ticket.id}
        ticketMecanicoId={ticket.mecanico?.id ?? null}
      />

      {/* Barra de acción fija: finalizar siempre accesible en mobile. */}
      <div className="-mx-4 fixed inset-x-0 bottom-0 z-20 border-border/70 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-auto sm:max-w-3xl sm:rounded-t-xl">
        <div className="mx-auto w-full max-w-3xl">
          <Button
            className="h-12 w-full"
            disabled={!canFinish}
            onClick={() => setFinishOpen(true)}
          >
            <CheckCircle2 />
            Finalizar trabajo
          </Button>
          {!canFinish && (
            <p className="mt-2 text-center text-muted-foreground text-xs">
              Debes subir al menos una foto para finalizar.
            </p>
          )}
        </div>
      </div>

      {preview && (
        <Dialog
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
          open={Boolean(preview)}
        >
          <DialogPopup className="max-w-3xl">
            <DialogTitle className="sr-only">{preview.fileName}</DialogTitle>
            <div className="flex flex-col gap-3">
              {preview.url ? (
                <Image
                  alt={preview.fileName}
                  className="max-h-[70vh] w-full rounded-lg object-contain"
                  height={1200}
                  src={preview.url}
                  unoptimized
                  width={1200}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center text-muted-foreground">
                  <ImageOff className="size-12" />
                </div>
              )}
              <p className="truncate px-1 pb-1 text-muted-foreground text-xs">
                {preview.fileName}
              </p>
            </div>
          </DialogPopup>
        </Dialog>
      )}

      <Dialog onOpenChange={setFinishOpen} open={finishOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Finalizar trabajo</DialogTitle>
            <DialogDescription>
              Agrega una observacion final antes de cerrar la ejecucion.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <Textarea
              onChange={(event) => setObservacion(event.target.value)}
              placeholder="Ej: se reemplazo filtro y se verifico funcionamiento."
              value={observacion}
            />
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button loading={finishTicket.isPending} onClick={handleFinish}>
              Finalizar
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
