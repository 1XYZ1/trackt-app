"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Package,
  Pencil,
  PlusCircle,
  PowerOff,
  Sliders,
} from "lucide-react";
import { EmptyState } from "@/components/core";
import {
  AjusteStockDialog,
  DesactivarRepuestoDialog,
  EntradaStockDialog,
  RepuestoFormSheet,
} from "@/components/inventario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useHasRole } from "@/contexts/auth-context";
import { useRepuesto } from "@/hooks/use-inventario";
import type { MovimientoTipo } from "@/lib/api/inventario";

function tipoBadgeVariant(
  tipo: MovimientoTipo,
): "default" | "secondary" | "outline" | "error" | "warning" {
  switch (tipo) {
    case "ENTRADA":
      return "default";
    case "CONSUMO":
    case "SALIDA":
      return "secondary";
    case "AJUSTE":
      return "warning";
    default:
      return "outline";
  }
}

export function RepuestoDetalleClient({ id }: { id: string }) {
  const isAdmin = useHasRole("admin");
  const { data: repuesto, error, isLoading } = useRepuesto(id);
  const [editOpen, setEditOpen] = useState(false);
  const [entradaOpen, setEntradaOpen] = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [desactivarOpen, setDesactivarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Cargando repuesto...
      </div>
    );
  }

  if (error || !repuesto) {
    return (
      <EmptyState
        icon="wrench"
        message="No se pudo cargar el detalle del repuesto."
        title="Error al cargar"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
            <Package className="size-3.5" />
            Detalle de repuesto
          </div>
          <h1 className="flex items-center gap-3 font-semibold text-2xl tracking-tight">
            <span className="font-mono">{repuesto.codigo}</span>
            <Badge variant={repuesto.activo ? "default" : "outline"}>
              {repuesto.activo ? "Activo" : "Inactivo"}
            </Badge>
            {repuesto.bajoStock && (
              <Badge variant="error">
                <AlertTriangle className="size-3" />
                Bajo stock
              </Badge>
            )}
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">{repuesto.nombre}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/inventario">
            <Button size="sm" variant="outline">
              <ArrowLeft />
              Volver
            </Button>
          </Link>
          {isAdmin && (
            <>
              <Button
                onClick={() => setEntradaOpen(true)}
                size="sm"
                variant="ghost"
              >
                <PlusCircle />
                Entrada
              </Button>
              <Button
                onClick={() => setAjusteOpen(true)}
                size="sm"
                variant="ghost"
              >
                <Sliders />
                Ajustar
              </Button>
              <Button
                onClick={() => setEditOpen(true)}
                size="sm"
                variant="ghost"
              >
                <Pencil />
                Editar
              </Button>
              <Button
                disabled={!repuesto.activo}
                onClick={() => setDesactivarOpen(true)}
                size="sm"
                variant="destructive-outline"
              >
                <PowerOff />
                Desactivar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-lg border-border/70">
          <CardContent className="p-4">
            <p className="font-medium text-[11px] text-muted-foreground uppercase">
              Stock actual
            </p>
            <p className="mt-2 font-mono font-semibold text-2xl">
              {repuesto.stockActual}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-border/70">
          <CardContent className="p-4">
            <p className="font-medium text-[11px] text-muted-foreground uppercase">
              Reservado
            </p>
            <p className="mt-2 font-mono font-semibold text-2xl">
              {repuesto.stockReservado}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-border/70">
          <CardContent className="p-4">
            <p className="font-medium text-[11px] text-muted-foreground uppercase">
              Disponible
            </p>
            <p
              className={`mt-2 font-mono font-semibold text-2xl ${
                repuesto.bajoStock ? "text-destructive" : ""
              }`}
            >
              {repuesto.stockDisponible}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-border/70">
          <CardContent className="p-4">
            <p className="font-medium text-[11px] text-muted-foreground uppercase">
              Stock minimo
            </p>
            <p className="mt-2 font-mono font-semibold text-2xl">
              {repuesto.stockMinimo}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ficha</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <Field label="Categoria" value={repuesto.categoria ?? "—"} />
            <Field label="Unidad" value={repuesto.unidad} />
            <Field
              label="Descripcion"
              value={repuesto.descripcion ?? "—"}
              colSpan
            />
            <Field
              label="Creado"
              value={new Date(repuesto.createdAt).toLocaleString("es-CL")}
            />
            <Field
              label="Ultima modificacion"
              value={new Date(repuesto.updatedAt).toLocaleString("es-CL")}
            />
          </div>
        </CardContent>
      </Card>

      {repuesto.movimientosRecientes &&
        repuesto.movimientosRecientes.length > 0 && (
          <Card className="rounded-lg border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Movimientos recientes</CardTitle>
              <p className="text-muted-foreground text-xs">
                Ultimos 10 cambios de stock para este repuesto.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                      <th className="px-5 py-3 font-semibold">Fecha</th>
                      <th className="px-5 py-3 font-semibold">Tipo</th>
                      <th className="px-5 py-3 text-right font-semibold">
                        Cantidad
                      </th>
                      <th className="px-5 py-3 text-right font-semibold">
                        Stock resultante
                      </th>
                      <th className="px-5 py-3 font-semibold">Observacion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repuesto.movimientosRecientes.map((m) => (
                      <tr
                        className="border-border/60 border-b last:border-0"
                        key={m.id}
                      >
                        <td className="whitespace-nowrap px-5 py-3 text-muted-foreground text-xs">
                          {new Date(m.createdAt).toLocaleString("es-CL")}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <Badge variant={tipoBadgeVariant(m.tipo)}>
                            {m.tipo}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-xs">
                          {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-xs">
                          {m.stockResultante}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">
                          {m.observacion ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

      {isAdmin && (
        <>
          <RepuestoFormSheet
            onOpenChange={setEditOpen}
            open={editOpen}
            repuesto={repuesto}
          />
          <EntradaStockDialog
            onOpenChange={setEntradaOpen}
            open={entradaOpen}
            repuesto={repuesto}
          />
          <AjusteStockDialog
            onOpenChange={setAjusteOpen}
            open={ajusteOpen}
            repuesto={repuesto}
          />
          <DesactivarRepuestoDialog
            onOpenChange={setDesactivarOpen}
            open={desactivarOpen}
            repuesto={repuesto}
          />
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  colSpan = false,
}: {
  label: string;
  value: string;
  colSpan?: boolean;
}) {
  return (
    <div className={colSpan ? "md:col-span-2" : undefined}>
      <p className="font-medium text-[11px] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
