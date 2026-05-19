"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, PackagePlus, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useCreateReserva, useRepuestos } from "@/hooks/use-inventario";

interface Props {
  ticketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DraftItem = {
  uid: string;
  repuestoId: string;
  cantidad: number;
};

function newUid(): string {
  return Math.random().toString(36).slice(2);
}

export function NuevaReservaDialog({ onOpenChange, open, ticketId }: Props) {
  const [items, setItems] = useState<DraftItem[]>([
    { uid: newUid(), repuestoId: "", cantidad: 1 },
  ]);
  const [observacion, setObservacion] = useState("");
  const [solicitar, setSolicitar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = useAuth();
  // Solo mechanic puede crear reservas como solicitud pendiente — admin/jefe
  // crean directamente RESERVADA y aplican stockReservado al instante.
  const puedeSolicitar = auth.role === "mechanic";
  const repuestos = useRepuestos();
  const createReserva = useCreateReserva(ticketId);

  // Sumar lo que el draft ya pretende reservar por repuestoId para mostrar
  // un "disponible restante" en tiempo real al usuario.
  const drafted = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      if (it.repuestoId && it.cantidad > 0) {
        map.set(it.repuestoId, (map.get(it.repuestoId) ?? 0) + it.cantidad);
      }
    }
    return map;
  }, [items]);

  const reset = () => {
    setItems([{ uid: newUid(), repuestoId: "", cantidad: 1 }]);
    setObservacion("");
    setSolicitar(false);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const updateItem = (uid: string, patch: Partial<DraftItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)),
    );
    if (error) setError(null);
  };

  const removeItem = (uid: string) => {
    setItems((prev) => prev.filter((it) => it.uid !== uid));
  };

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      { uid: newUid(), repuestoId: "", cantidad: 1 },
    ]);
  };

  const handleSubmit = () => {
    const repuestosActivos = (repuestos.data ?? []).filter((r) => r.activo);
    const byId = new Map(repuestosActivos.map((r) => [r.id, r]));

    // Validaciones cliente: items completos, cantidades, stock disponible.
    if (items.length === 0) {
      setError("Agrega al menos un item");
      return;
    }
    const agg = new Map<string, number>();
    for (const it of items) {
      if (!it.repuestoId) {
        setError("Selecciona un repuesto para cada item");
        return;
      }
      if (!Number.isFinite(it.cantidad) || it.cantidad < 1) {
        setError("La cantidad debe ser un entero mayor o igual a 1");
        return;
      }
      agg.set(it.repuestoId, (agg.get(it.repuestoId) ?? 0) + it.cantidad);
    }
    for (const [repuestoId, total] of agg) {
      const r = byId.get(repuestoId);
      if (!r) {
        setError("Alguno de los repuestos no existe o esta inactivo");
        return;
      }
      if (total > r.stockDisponible) {
        setError(
          `Stock insuficiente para ${r.codigo}: disponible ${r.stockDisponible}, solicitado ${total}`,
        );
        return;
      }
    }
    setError(null);

    createReserva.mutate(
      {
        observacion: observacion.trim() || undefined,
        items: Array.from(agg.entries()).map(([repuestoId, cantidad]) => ({
          repuestoId,
          cantidad,
        })),
        solicitar: puedeSolicitar && solicitar ? true : undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            puedeSolicitar && solicitar
              ? "Solicitud enviada para aprobacion"
              : "Reserva creada",
          );
          reset();
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "No se pudo crear la reserva",
          );
        },
      },
    );
  };

  const repuestosActivos = (repuestos.data ?? []).filter((r) => r.activo);

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogPopup className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reservar repuestos</DialogTitle>
          <DialogDescription>
            Selecciona repuestos y cantidades para este ticket. Se aparta el
            stock hasta que se consuma o libere la reserva.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          {repuestos.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando repuestos...
            </div>
          ) : repuestos.error ? (
            <p className="text-destructive text-sm">
              No se pudieron cargar los repuestos.
            </p>
          ) : repuestosActivos.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No hay repuestos activos disponibles en este tenant.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                {items.map((it) => {
                  const r = repuestosActivos.find(
                    (rep) => rep.id === it.repuestoId,
                  );
                  const drafted_for = drafted.get(it.repuestoId) ?? 0;
                  const remaining = r
                    ? r.stockDisponible - (drafted_for - it.cantidad)
                    : 0;

                  return (
                    <div
                      className="grid items-end gap-2 sm:grid-cols-[1fr_120px_auto]"
                      key={it.uid}
                    >
                      <div className="space-y-1">
                        <label className="font-medium text-xs text-muted-foreground">
                          Repuesto
                        </label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                          onChange={(e) =>
                            updateItem(it.uid, { repuestoId: e.target.value })
                          }
                          value={it.repuestoId}
                        >
                          <option value="">— Selecciona —</option>
                          {repuestosActivos.map((rep) => (
                            <option key={rep.id} value={rep.id}>
                              {rep.codigo} - {rep.nombre} (disp: {rep.stockDisponible})
                            </option>
                          ))}
                        </select>
                        {r && (
                          <p className="text-[11px] text-muted-foreground">
                            Disponible: {r.stockDisponible} {r.unidad}
                            {r.stockDisponible > 0 && it.cantidad > remaining && (
                              <span className="ml-1 text-destructive">
                                — excede disponible
                              </span>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="font-medium text-xs text-muted-foreground">
                          Cantidad
                        </label>
                        <Input
                          min={1}
                          onChange={(e) =>
                            updateItem(it.uid, {
                              cantidad: Number(e.target.value),
                            })
                          }
                          step={1}
                          type="number"
                          value={it.cantidad}
                        />
                      </div>

                      <Button
                        disabled={items.length <= 1}
                        onClick={() => removeItem(it.uid)}
                        size="sm"
                        title="Quitar item"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  );
                })}
              </div>

              <Button
                onClick={addRow}
                size="sm"
                type="button"
                variant="outline"
              >
                Agregar otro repuesto
              </Button>

              <div className="space-y-2">
                <label
                  className="font-medium text-sm"
                  htmlFor="reserva-observacion"
                >
                  Observacion (opcional)
                </label>
                <Textarea
                  id="reserva-observacion"
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Repuestos necesarios para la reparacion del equipo..."
                  rows={2}
                  value={observacion}
                />
              </div>

              {puedeSolicitar && (
                <label className="flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/15 p-3 text-sm">
                  <input
                    checked={solicitar}
                    className="mt-1 size-4"
                    onChange={(e) => setSolicitar(e.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <span className="font-medium">
                      Crear como solicitud pendiente de aprobacion
                    </span>
                    <span className="mt-1 block text-muted-foreground text-xs">
                      El stock no se reserva hasta que un admin o jefe apruebe.
                      Util cuando aun no es seguro consumir los repuestos.
                    </span>
                  </span>
                </label>
              )}

              {error && <p className="text-destructive text-xs">{error}</p>}
            </div>
          )}
        </DialogPanel>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            disabled={!repuestosActivos.length}
            loading={createReserva.isPending}
            onClick={handleSubmit}
          >
            <PackagePlus />
            {puedeSolicitar && solicitar ? "Crear solicitud" : "Crear reserva"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
