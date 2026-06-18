"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/core";
import { RepuestoSelect } from "@/components/inventario";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useHasRole } from "@/contexts/auth-context";
import {
  useAddEquipoRepuesto,
  useEquipoRepuestos,
  useRemoveEquipoRepuesto,
} from "@/hooks/use-equipos";

export type EquipoRepuestosProps = {
  equipoId: string;
};

export function EquipoRepuestos({ equipoId }: EquipoRepuestosProps) {
  const isAdmin = useHasRole("admin");
  const isJefe = useHasRole("jefe_taller");
  const canManage = isAdmin || isJefe;
  const { data: asociados = [], error, isLoading } =
    useEquipoRepuestos(equipoId);
  const addRepuesto = useAddEquipoRepuesto(equipoId);
  const removeRepuesto = useRemoveEquipoRepuesto(equipoId);

  const [repuestoId, setRepuestoId] = useState("");
  const [cantidadRef, setCantidadRef] = useState("");
  const [observacion, setObservacion] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!repuestoId) {
      toast.error("Selecciona un repuesto");
      return;
    }
    const cantidad = Number.parseInt(cantidadRef, 10);
    addRepuesto.mutate(
      {
        repuestoId,
        cantidadRef:
          cantidadRef && Number.isFinite(cantidad) && cantidad > 0
            ? cantidad
            : undefined,
        observacion: observacion.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Repuesto asociado");
          setRepuestoId("");
          setCantidadRef("");
          setObservacion("");
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "No se pudo asociar el repuesto",
          ),
      },
    );
  };

  const handleRemove = (repuesto: string, codigo: string) => {
    setRemovingId(repuesto);
    removeRepuesto.mutate(repuesto, {
      onSuccess: () => toast.success(`Repuesto ${codigo} desasociado`),
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : "No se pudo quitar el repuesto",
        ),
      onSettled: () => setRemovingId(null),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <Card className="rounded-lg border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Asociar repuesto habitual</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] text-muted-foreground uppercase">
                Repuesto
              </label>
              <RepuestoSelect
                excludeIds={asociados.map((a) => a.repuesto.id)}
                onChange={setRepuestoId}
                value={repuestoId}
              />
            </div>
            <div className="w-full space-y-1 sm:w-28">
              <label className="text-[11px] text-muted-foreground uppercase">
                Cant. ref.
              </label>
              <Input
                min={1}
                onChange={(e) => setCantidadRef(e.target.value)}
                placeholder="—"
                step={1}
                type="number"
                value={cantidadRef}
              />
            </div>
            <div className="w-full flex-1 space-y-1">
              <label className="text-[11px] text-muted-foreground uppercase">
                Observación
              </label>
              <Input
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Opcional"
                value={observacion}
              />
            </div>
            <Button loading={addRepuesto.isPending} onClick={handleAdd}>
              <Plus />
              Asociar
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-lg border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Repuestos habituales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center gap-2 px-5 py-10 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando repuestos...
            </div>
          )}

          {!isLoading && error && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="No se pudieron cargar los repuestos asociados."
                title="Error al cargar"
              />
            </div>
          )}

          {!isLoading && !error && asociados.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="Asocia repuestos habituales para agilizar las reservas y plantillas de este equipo."
                title="Sin repuestos asociados"
              />
            </div>
          )}

          {!isLoading && !error && asociados.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3 font-semibold">Codigo</th>
                    <th className="px-5 py-3 font-semibold">Nombre</th>
                    <th className="px-5 py-3 text-right font-semibold">Disponible</th>
                    <th className="px-5 py-3 text-right font-semibold">Cant. ref.</th>
                    <th className="px-5 py-3 font-semibold">Observación</th>
                    {canManage && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {asociados.map((a) => (
                    <tr
                      className="border-border/60 border-b transition-colors last:border-0"
                      key={a.id}
                    >
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs">
                        {a.repuesto.codigo}
                      </td>
                      <td className="px-5 py-3">{a.repuesto.nombre}</td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {a.repuesto.stockDisponible} {a.repuesto.unidad}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {a.cantidadRef ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">
                        {a.observacion ?? "—"}
                      </td>
                      {canManage && (
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          <Button
                            loading={
                              removeRepuesto.isPending &&
                              removingId === a.repuesto.id
                            }
                            onClick={() =>
                              handleRemove(a.repuesto.id, a.repuesto.codigo)
                            }
                            size="sm"
                            variant="destructive-outline"
                          >
                            <Trash2 />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
