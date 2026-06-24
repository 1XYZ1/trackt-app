"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Package,
  PackageCheck,
  Pencil,
  PlusCircle,
  PowerOff,
  QrCode,
  Sliders,
  Warehouse,
} from "lucide-react";
import { DetailBreadcrumb, EmptyState } from "@/components/core";
import {
  AjusteStockDialog,
  DesactivarRepuestoDialog,
  EntradaStockDialog,
  EquiposAsociadosCard,
  MovimientoBadge,
  MovimientoCantidad,
  RepuestoFormSheet,
  RepuestoQrDialog,
  StockBar,
} from "@/components/inventario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasRole } from "@/contexts/auth-context";
import { useRepuesto } from "@/hooks/use-inventario";
import { cn } from "@/lib/utils";

export function RepuestoDetalleClient({ id }: { id: string }) {
  const isAdmin = useHasRole("admin");
  // admin y jefe_inventario gestionan el QR (regenerar). El resto solo lo ve.
  const canManageQr = useHasRole("admin", "jefe_inventario");
  const { data: repuesto, error, isLoading } = useRepuesto(id);
  const [editOpen, setEditOpen] = useState(false);
  const [entradaOpen, setEntradaOpen] = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [desactivarOpen, setDesactivarOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  if (isLoading) {
    return <DetalleSkeleton />;
  }

  if (error || !repuesto) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/inventario">
          <Button size="sm" variant="outline">
            <ArrowLeft />
            Volver a inventario
          </Button>
        </Link>
        <EmptyState
          icon="wrench"
          message="No se pudo cargar el detalle del repuesto. Verifica el enlace o reintenta."
          title="Error al cargar"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2">
            <DetailBreadcrumb
              current={repuesto.codigo}
              parentHref="/inventario"
              parentLabel="Inventario"
            />
          </div>
          <h1 className="flex flex-wrap items-center gap-x-3 gap-y-2 font-semibold text-2xl tracking-tight">
            <span className="font-mono">{repuesto.codigo}</span>
            <Badge variant={repuesto.activo ? "success" : "outline"}>
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
          {/* Visible a todos los roles: ver/copiar el QR del repuesto. */}
          <Button onClick={() => setQrOpen(true)} size="sm" variant="outline">
            <QrCode />
            Código QR
          </Button>
          {isAdmin && (
            <>
              <Button
                onClick={() => setEntradaOpen(true)}
                size="sm"
                variant="outline"
              >
                <PlusCircle />
                Entrada
              </Button>
              <Button
                onClick={() => setAjusteOpen(true)}
                size="sm"
                variant="outline"
              >
                <Sliders />
                Ajustar
              </Button>
              <Button
                onClick={() => setEditOpen(true)}
                size="sm"
                variant="outline"
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Warehouse className="size-4" />}
          label="Stock actual"
          value={repuesto.stockActual}
        />
        <StatCard
          icon={<PackageCheck className="size-4" />}
          label="Reservado"
          value={repuesto.stockReservado}
        />
        <StatCard
          highlight={repuesto.bajoStock}
          icon={<Package className="size-4" />}
          label="Disponible"
          value={repuesto.stockDisponible}
        />
        <StatCard
          icon={<AlertTriangle className="size-4" />}
          label="Stock mínimo"
          value={repuesto.stockMinimo}
        />
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Composición del stock</CardTitle>
          <p className="text-muted-foreground text-xs">
            Distribución del stock actual entre unidades reservadas y
            disponibles.
          </p>
        </CardHeader>
        <CardContent>
          <StockBar
            actual={repuesto.stockActual}
            disponible={repuesto.stockDisponible}
            reservado={repuesto.stockReservado}
          />
        </CardContent>
      </Card>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ficha</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <Field label="Categoría" value={repuesto.categoria ?? "—"} />
            <Field label="Unidad" value={repuesto.unidad} />
            <Field label="Marca" value={repuesto.marca?.nombre ?? "—"} />
            <Field
              label="Código fabricante"
              value={repuesto.codigoFabricante ?? "—"}
            />
            <Field
              label="Ubicación bodega"
              value={repuesto.ubicacionBodega ?? "—"}
            />
            <Field label="Proveedor" value={repuesto.proveedor ?? "—"} />
            <Field
              colSpan
              label="Descripción"
              value={repuesto.descripcion ?? "—"}
            />
            <Field
              label="Creado"
              value={new Date(repuesto.createdAt).toLocaleString("es-CL")}
            />
            <Field
              label="Última modificación"
              value={new Date(repuesto.updatedAt).toLocaleString("es-CL")}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Movimientos recientes</CardTitle>
          <p className="text-muted-foreground text-xs">
            Últimos 10 cambios de stock para este repuesto.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {repuesto.movimientosRecientes &&
          repuesto.movimientosRecientes.length > 0 ? (
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
                    <th className="px-5 py-3 font-semibold">Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {repuesto.movimientosRecientes.map((m) => (
                    <tr
                      className="border-border/60 border-b transition-colors last:border-0 hover:bg-secondary/25"
                      key={m.id}
                    >
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground text-xs tabular-nums">
                        {new Date(m.createdAt).toLocaleString("es-CL")}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <MovimientoBadge tipo={m.tipo} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <MovimientoCantidad cantidad={m.cantidad} />
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">
                        {m.stockResultante}
                      </td>
                      <td className="max-w-xs px-5 py-3 text-muted-foreground text-xs">
                        {m.observacion ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                className="min-h-44"
                icon="search"
                message="Este repuesto todavía no tiene movimientos de stock."
                title="Sin movimientos"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <EquiposAsociadosCard equipos={repuesto.equiposAsociados} />

      <RepuestoQrDialog
        canManage={canManageQr}
        onOpenChange={setQrOpen}
        open={qrOpen}
        repuesto={repuesto}
      />

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

function StatCard({
  highlight = false,
  icon,
  label,
  value,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "rounded-lg border-border/70",
        highlight && "border-warning/30 bg-warning/4",
      )}
    >
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
          <span
            className={cn(
              "text-muted-foreground",
              highlight && "text-warning-foreground",
            )}
          >
            {icon}
          </span>
          {label}
        </p>
        <p
          className={cn(
            "mt-2 font-mono font-semibold text-2xl tabular-nums",
            highlight && "text-warning-foreground",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function DetalleSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card className="rounded-lg border-border/70" key={idx}>
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-lg border-border/70">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-4 w-40" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton className="h-10 w-full" key={idx} />
            ))}
          </div>
        </CardContent>
      </Card>
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
    <div className={colSpan ? "sm:col-span-2" : undefined}>
      <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  );
}
