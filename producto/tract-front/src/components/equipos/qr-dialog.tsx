"use client";

import { QRCodeSVG } from "qrcode.react";
import { Copy, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import type { EquipoDetalle } from "@/lib/api/equipos";

export type QrDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipo: EquipoDetalle | null;
  /**
   * Conservada por compatibilidad con los llamadores. El QR nace por defecto,
   * así que el diálogo es solo de consulta y no usa este flag.
   */
  canManage?: boolean;
};

export function QrDialog({ equipo, onOpenChange, open }: QrDialogProps) {
  const token = equipo?.qrToken ?? null;

  // El QR debe codificar la URL navegable (no el token crudo) para que la
  // cámara del teléfono abra directamente la página del equipo. Usa
  // NEXT_PUBLIC_SITE_URL y cae al origin del navegador si no está configurada.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const qrValue = token ? `${siteUrl}/q/${token}` : "";

  const handleCopy = async () => {
    if (!qrValue) return;
    try {
      await navigator.clipboard.writeText(qrValue);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5" />
            Código QR del equipo
          </DialogTitle>
          <DialogDescription>
            {equipo
              ? `${equipo.codigo} — ${equipo.nombre}`
              : "Equipo no disponible"}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-border">
              <QRCodeSVG level="M" size={220} value={qrValue} />
            </div>
            <p className="text-center text-muted-foreground text-xs">
              Escanéalo con la cámara para abrir la ficha del equipo.
            </p>
            <div className="w-full space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                Enlace del QR
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-secondary px-2 py-1.5 font-mono text-xs">
                  {qrValue}
                </code>
                <Button
                  aria-label="Copiar enlace del QR"
                  onClick={handleCopy}
                  size="icon"
                  variant="outline"
                >
                  <Copy />
                </Button>
              </div>
            </div>
          </div>
        </DialogPanel>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cerrar</DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
