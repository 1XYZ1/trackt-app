"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/core";
import { RepuestoSelect } from "@/components/inventario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasRole } from "@/contexts/auth-context";
import {
  useAddTipoEquipoRepuesto,
  useRemoveTipoEquipoRepuesto,
  useTipoEquipoRepuestos,
} from "@/hooks/use-tipos-equipo";

export type TipoEquipoRepuestosProps = {
  tipoEquipoId: string;
};

export function TipoEquipoRepuestos({ tipoEquipoId }: TipoEquipoRepuestosProps) {
  // El catálogo de tipos de equipo es administración: solo admin gestiona.
  const canManage = useHasRole("admin");
  const { data: asociados = [], error, isLoading } =
    useTipoEquipoRepuestos(tipoEquipoId);
  const addRepuesto = useAddTipoEquipoRepuesto(tipoEquipoId);
  const removeRepuesto = useRemoveTipoEquipoRepuesto(tipoEquipoId);

  const [repuestoId, setRepuestoId] = useState("");
  const [cantidadRef, setCantidadRef] = useState("");
  const [obligatorio, setObligatorio] = useState(true);
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
        obligatorio,
        observacion: observacion.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Repuesto agregado al tipo");
          setRepuestoId("");
          setCantidadRef("");
          setObligatorio(true);
          setObservacion("");
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "No se pudo agregar el repuesto",
          ),
      },
    );
  };

  const handleRemove = (repuesto: string, codigo: string) => {
    setRemovingId(repuesto);
    removeRepuesto.mutate(repuesto, {
      onSuccess: () => toast.success(`Repuesto ${codigo} quitado`),
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Agregar repuesto default</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex-1 space-y-1 sm:min-w-56">
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
            <div className="w-full flex-1 space-y-1 sm:min-w-44">
              <label className="text-[11px] text-muted-foreground uppercase">
                Observación
              </label>
              <Input
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Opcional"
                value={observacion}
              />
            </div>
            <Label
              className="flex h-9 items-center gap-2 text-sm"
              htmlFor="repuesto-obligatorio"
            >
              <Checkbox
                checked={obligatorio}
                id="repuesto-obligatorio"
                onCheckedChange={(checked) => setObligatorio(checked === true)}
              />
              Obligatorio
            </Label>
            <Button loading={addRepuesto.isPending} onClick={handleAdd}>
              <Plus />
              Agregar
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Repuestos default</CardTitle>
          <p className="text-muted-foreground text-xs">
            Se copian automáticamente a los repuestos habituales al crear un
            equipo de este tipo.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="space-y-2.5 p-5">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton className="h-9 w-full" key={idx} />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="No se pudieron cargar los repuestos default del tipo."
                title="Error al cargar"
              />
            </div>
          )}

          {!isLoading && !error && asociados.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="Agrega repuestos default para que se sugieran automáticamente al crear equipos de este tipo."
                title="Sin repuestos default"
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
                    <th className="px-5 py-3 font-semibold">Obligatorio</th>
                    <th className="px-5 py-3 font-semibold">Observación</th>
                    {canManage && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {asociados.map((a) => (
                    <tr
                      className="border-border/60 border-b transition-colors last:border-0 hover:bg-accent/40"
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
                      <td className="whitespace-nowrap px-5 py-3">
                        <Badge variant={a.obligatorio ? "default" : "outline"}>
                          {a.obligatorio ? "Sí" : "No"}
                        </Badge>
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
