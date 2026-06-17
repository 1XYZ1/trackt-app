"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { EmptyState } from "@/components/core";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvidencias } from "@/hooks/use-evidencias";
import type { Evidencia } from "@/lib/api/evidencias";

interface Props {
  ticketId: string;
}

export function EvidenciasGrid({ ticketId }: Props) {
  const { data, isLoading, error } = useEvidencias(ticketId);
  const [openEvidencia, setOpenEvidencia] = useState<Evidencia | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton className="aspect-square rounded-lg" key={idx} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm">
        <ImageOff className="size-4" />
        No se pudieron cargar las evidencias.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon="inbox"
        message="Aún no hay fotos subidas en este ticket."
        title="Sin evidencias"
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {data.map((evidencia) => (
          <button
            className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted transition hover:border-primary"
            key={evidencia.id}
            onClick={() => setOpenEvidencia(evidencia)}
            type="button"
          >
            {evidencia.downloadUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={evidencia.descripcion ?? "Evidencia"}
                className="size-full object-cover transition group-hover:scale-105"
                src={evidencia.downloadUrl}
              />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <ImageOff className="size-6" />
              </div>
            )}
          </button>
        ))}
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setOpenEvidencia(null);
        }}
        open={Boolean(openEvidencia)}
      >
        <DialogPopup className="max-w-4xl">
          <DialogTitle className="sr-only">Evidencia</DialogTitle>
          {openEvidencia && (
            <div className="flex flex-col gap-3">
              {openEvidencia.downloadUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={openEvidencia.descripcion ?? "Evidencia"}
                  className="max-h-[70vh] w-full object-contain"
                  src={openEvidencia.downloadUrl}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center text-muted-foreground">
                  <ImageOff className="size-12" />
                </div>
              )}
              <div className="space-y-1 px-2 pb-2 text-sm">
                {openEvidencia.descripcion && (
                  <p>{openEvidencia.descripcion}</p>
                )}
                <p className="text-muted-foreground text-xs">
                  Subida el{" "}
                  {new Date(openEvidencia.createdAt).toLocaleString("es-CL")}
                </p>
              </div>
            </div>
          )}
        </DialogPopup>
      </Dialog>
    </>
  );
}
