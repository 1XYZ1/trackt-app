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
import { useGenerarQrRepuesto } from "@/hooks/use-inventario";
import type { Repuesto } from "@/lib/api/inventario";

export type RepuestoQrDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repuesto: Pick<Repuesto, "id" | "codigo" | "nombre" | "qrToken"> | null;
  canManage?: boolean;
};

// Diálogo del QR del repuesto (espejo de equipos/qr-dialog). El QR codifica la
// URL navegable /r/[token] (no el token crudo) para que la cámara abra la
// ficha mobile del repuesto directamente.
export function RepuestoQrDialog({
  canManage = false,
  onOpenChange,
  open,
  repuesto,
}: RepuestoQrDialogProps) {
  const generarQr = useGenerarQrRepuesto();
  const [confirmRegen, setConfirmRegen] = useState(false);

  const token = repuesto?.qrToken ?? null;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const qrValue = token ? `${siteUrl}/r/${token}` : "";

  const handleGenerar = () => {
    if (!repuesto) return;
    generarQr.mutate(repuesto.id, {
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
            Código QR del repuesto
          </DialogTitle>
          <DialogDescription>
            {repuesto
              ? `${repuesto.codigo} — ${repuesto.nombre}`
              : "Repuesto no disponible"}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <div className="flex flex-col items-center gap-4">
            {token ? (
              <>
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-border">
                  <QRCodeSVG level="M" size={220} value={qrValue} />
                </div>
                <p className="text-center text-muted-foreground text-xs">
                  Escanéalo con la cámara para abrir la ficha del repuesto.
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
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/20 ring-inset">
                  <QrCode className="size-6" />
                </div>
                <p className="max-w-xs text-muted-foreground text-sm">
                  Este repuesto aún no tiene un código QR generado.
                </p>
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
