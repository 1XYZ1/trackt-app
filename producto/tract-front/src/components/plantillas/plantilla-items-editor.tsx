"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/core";
import { RepuestoSelect } from "@/components/inventario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useAddPlantillaItem,
  useRemovePlantillaItem,
  useUpdatePlantillaItem,
} from "@/hooks/use-plantillas";
import type { PlantillaItem } from "@/lib/api/plantillas";

export type PlantillaItemsEditorProps = {
  plantillaId: string;
  items: PlantillaItem[];
  canManage: boolean;
};

export function PlantillaItemsEditor({
  canManage,
  items,
  plantillaId,
}: PlantillaItemsEditorProps) {
  const addItem = useAddPlantillaItem(plantillaId);
  const updateItem = useUpdatePlantillaItem(plantillaId);
  const removeItem = useRemovePlantillaItem(plantillaId);

  const [repuestoId, setRepuestoId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [obligatorio, setObligatorio] = useState(true);
  const [observacion, setObservacion] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAdd = () => {
    const n = Number.parseInt(cantidad, 10);
    if (!repuestoId) {
      toast.error("Selecciona un repuesto");
      return;
    }
    if (!Number.isFinite(n) || n < 1) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }
    addItem.mutate(
      {
        repuestoId,
        cantidad: n,
        obligatorio,
        observacion: observacion.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Ítem agregado");
          setRepuestoId("");
          setCantidad("1");
          setObligatorio(true);
          setObservacion("");
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "No se pudo agregar el ítem",
          ),
      },
    );
  };

  const patch = (
    item: PlantillaItem,
    payload: { cantidad?: number; obligatorio?: boolean; observacion?: string | null },
  ) => {
    updateItem.mutate(
      { itemId: item.id, payload },
      {
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "No se pudo actualizar el ítem",
          ),
      },
    );
  };

  const handleRemove = (item: PlantillaItem) => {
    setRemovingId(item.id);
    removeItem.mutate(item.id, {
      onSuccess: () => toast.success("Ítem eliminado"),
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : "No se pudo eliminar el ítem",
        ),
      onSettled: () => setRemovingId(null),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <Card className="rounded-lg border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Agregar insumo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] text-muted-foreground uppercase">
                Repuesto
              </label>
              <RepuestoSelect
                excludeIds={items.map((i) => i.repuesto.id)}
                onChange={setRepuestoId}
                value={repuestoId}
              />
            </div>
            <div className="w-full space-y-1 sm:w-24">
              <label className="text-[11px] text-muted-foreground uppercase">
                Cantidad
              </label>
              <Input
                min={1}
                onChange={(e) => setCantidad(e.target.value)}
                step={1}
                type="number"
                value={cantidad}
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                checked={obligatorio}
                onChange={(e) => setObligatorio(e.target.checked)}
                type="checkbox"
              />
              Obligatorio
            </label>
            <Button loading={addItem.isPending} onClick={handleAdd}>
              <Plus />
              Agregar
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-lg border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Insumos de la plantilla</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="Agrega los repuestos sugeridos para esta plantilla."
                title="Sin insumos"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3 font-semibold">Repuesto</th>
                    <th className="px-5 py-3 text-right font-semibold">Disponible</th>
                    <th className="px-5 py-3 font-semibold">Cantidad</th>
                    <th className="px-5 py-3 font-semibold">Obligatorio</th>
                    {canManage && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      className="border-border/60 border-b last:border-0"
                      key={item.id}
                    >
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs">
                          {item.repuesto.codigo}
                        </span>
                        <span className="block text-muted-foreground text-xs">
                          {item.repuesto.nombre}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {item.repuesto.stockDisponible} {item.repuesto.unidad}
                      </td>
                      <td className="px-5 py-3">
                        {canManage ? (
                          <Input
                            className="w-20"
                            defaultValue={item.cantidad}
                            min={1}
                            onBlur={(e) => {
                              const n = Number.parseInt(e.target.value, 10);
                              if (Number.isFinite(n) && n >= 1 && n !== item.cantidad) {
                                patch(item, { cantidad: n });
                              }
                            }}
                            step={1}
                            type="number"
                          />
                        ) : (
                          <span className="tabular-nums">{item.cantidad}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {canManage ? (
                          <input
                            checked={item.obligatorio}
                            onChange={(e) =>
                              patch(item, { obligatorio: e.target.checked })
                            }
                            type="checkbox"
                          />
                        ) : (
                          <Badge variant={item.obligatorio ? "default" : "outline"}>
                            {item.obligatorio ? "Sí" : "No"}
                          </Badge>
                        )}
                      </td>
                      {canManage && (
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          <Button
                            loading={removeItem.isPending && removingId === item.id}
                            onClick={() => handleRemove(item)}
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
