"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Copy, QrCode, RefreshCw } from "lucide-react";
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
import { useGenerarQr } from "@/hooks/use-equipos";
import type { EquipoDetalle } from "@/lib/api/equipos";

export type QrDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipo: EquipoDetalle | null;
  canManage?: boolean;
};

export function QrDialog({
  canManage = false,
  equipo,
  onOpenChange,
  open,
}: QrDialogProps) {
  const generarQr = useGenerarQr();
  const [confirmRegen, setConfirmRegen] = useState(false);

  const token = equipo?.qrToken ?? null;

  // El QR debe codificar la URL navegable (no el token crudo) para que la
  // cámara del teléfono abra directamente la página del equipo. Usa
  // NEXT_PUBLIC_SITE_URL y cae al origin del navegador si no está configurada.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const qrValue = token ? `${siteUrl}/q/${token}` : "";

  const handleGenerar = () => {
    if (!equipo) return;
    generarQr.mutate(equipo.id, {
      onSuccess: () => {
        toast.success(token ? "QR regenerado" : "QR generado");
        setConfirmRegen(false);
      },
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : "No se pudo generar el QR",
        ),
    });
  };

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
            {token ? (
              <>
                <div className="rounded-xl bg-white p-4">
                  <QRCodeSVG level="M" size={220} value={qrValue} />
                </div>
                <div className="w-full space-y-1">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    Enlace del QR
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-md bg-secondary px-2 py-1.5 font-mono text-xs">
                      {qrValue}
                    </code>
                    <Button onClick={handleCopy} size="icon" variant="outline">
                      <Copy />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-muted-foreground text-sm">
                Este equipo aún no tiene un código QR generado.
              </div>
            )}

            {confirmRegen && (
              <p className="text-center text-destructive-foreground text-xs">
                Regenerar invalida el QR impreso anterior. ¿Continuar?
              </p>
            )}
          </div>
        </DialogPanel>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cerrar</DialogClose>
          {canManage &&
            (token ? (
              confirmRegen ? (
                <Button
                  loading={generarQr.isPending}
                  onClick={handleGenerar}
                  variant="destructive"
                >
                  <RefreshCw />
                  Confirmar regeneración
                </Button>
              ) : (
                <Button onClick={() => setConfirmRegen(true)} variant="outline">
                  <RefreshCw />
                  Regenerar
                </Button>
              )
            ) : (
              <Button loading={generarQr.isPending} onClick={handleGenerar}>
                <QrCode />
                Generar QR
              </Button>
            ))}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
