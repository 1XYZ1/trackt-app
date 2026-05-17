"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
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
import { Textarea } from "@/components/ui/textarea";
import {
  useFinalizarEjecucion,
  useMiTicket,
  useSubirEvidencia,
} from "@/hooks/use-mis-tickets";
import type { TicketEvidence } from "@/lib/api/mis-tickets";

function getPriorityVariant(priority: "BAJA" | "MEDIA" | "ALTA") {
  if (priority === "ALTA") return "error";
  if (priority === "MEDIA") return "warning";
  return "secondary";
}

function EvidenceGrid({ evidencias }: { evidencias: TicketEvidence[] }) {
  if (evidencias.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
        Aun no hay fotos cargadas.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {evidencias.map((evidencia) => (
        <div
          className="overflow-hidden rounded-xl border border-border bg-secondary/20"
          key={evidencia.id}
        >
          <Image
            alt={evidencia.fileName}
            className="aspect-square w-full object-cover"
            height={280}
            src={evidencia.url}
            unoptimized
            width={280}
          />
          <div className="p-2">
            <p className="truncate text-xs">{evidencia.fileName}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MiTicketDetalleClient({ id }: { id: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [observacion, setObservacion] = useState("");
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
        if (e.url.startsWith("blob:")) URL.revokeObjectURL(e.url);
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
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Cargando ticket...
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <EmptyState
        icon="ticket"
        message="No se pudo cargar el ticket asignado."
        title="Error al cargar ticket"
      />
    );
  }

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

      <Card className="rounded-xl border-border/70">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono font-semibold text-muted-foreground text-xs">
                {ticket.codigo}
              </p>
              <h1 className="mt-1 font-semibold text-2xl leading-tight">
                {ticket.titulo}
              </h1>
            </div>
            <Badge variant={getPriorityVariant(ticket.prioridad)}>
              {ticket.prioridad}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge estado={ticket.estado} />
            <Badge variant="outline">{ticket.ordenCodigo}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">{ticket.descripcion}</p>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/70">
        <CardContent className="flex items-start gap-3 p-4">
          <Wrench className="mt-1 size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Equipo</p>
            <p className="mt-1 text-muted-foreground text-sm">{ticket.equipo}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Evidencias</CardTitle>
          <p className="text-muted-foreground text-xs">
            Sube fotos del avance o resultado antes de finalizar.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <EvidenceGrid evidencias={evidencias} />

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
            className="h-14 w-full text-base"
            disabled={uploadEvidence.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <Camera />
            Camara / Galeria
          </Button>
        </CardContent>
      </Card>

      <div className="sticky bottom-3 z-10">
        <Button
          className="h-14 w-full rounded-xl text-base shadow-lg"
          disabled={evidencias.length === 0}
          onClick={() => setFinishOpen(true)}
        >
          <CheckCircle2 />
          Finalizar trabajo
        </Button>
        {evidencias.length === 0 && (
          <p className="mt-2 text-center text-muted-foreground text-xs">
            Debes subir al menos una foto para finalizar.
          </p>
        )}
      </div>

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
