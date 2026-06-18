"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  History,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  PlusCircle,
  PowerOff,
  Search,
  Sliders,
} from "lucide-react";
import { EmptyState } from "@/components/core";
import {
  AjusteStockDialog,
  DesactivarRepuestoDialog,
  EntradaStockDialog,
  RepuestoFormSheet,
  StockDisponibleBadge,
} from "@/components/inventario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasRole } from "@/contexts/auth-context";
import { useRepuestos } from "@/hooks/use-inventario";
import { cn } from "@/lib/utils";
import type { Repuesto } from "@/lib/api/inventario";

export function InventarioClient() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [bajoStock, setBajoStock] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [categoria, setCategoria] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Repuesto | null>(null);
  const [entradaTarget, setEntradaTarget] = useState<Repuesto | null>(null);
  const [ajusteTarget, setAjusteTarget] = useState<Repuesto | null>(null);
  const [desactivarTarget, setDesactivarTarget] = useState<Repuesto | null>(null);

  // admin y jefe_inventario gestionan repuestos y stock (crear/editar/
  // desactivar, entradas y ajustes). El backend autoriza a ambos.
  const canManage = useHasRole("admin", "jefe_inventario");
  const canSeeMovimientos = useHasRole("admin", "jefe_taller", "jefe_inventario");
  // admin, jefe_taller y jefe_inventario pueden ver inactivos.
  const canSeeInactivos = useHasRole("admin", "jefe_taller", "jefe_inventario");

  // Debounce search 300ms para no martillar el endpoint con cada tecla.
  useEffect(() => {
    const trimmed = query.trim();
    const t = setTimeout(() => setDebouncedQuery(trimmed), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: repuestos = [], error, isLoading } = useRepuestos({
    bajoStock,
    includeInactive,
    search: debouncedQuery || undefined,
    categoria: categoria || undefined,
  });

  // Opciones de categoria derivadas del listado actual (deduplicar). Cuando
  // hay filtro por categoria activo, traemos solo esa categoria — entonces
  // hacemos un segundo fetch sin categoria para tener todas las opciones.
  const categoriasDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const r of repuestos) {
      if (r.categoria) set.add(r.categoria);
    }
    if (categoria) set.add(categoria); // mantener la seleccionada en options
    return Array.from(set).sort();
  }, [repuestos, categoria]);

  const filtered = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return repuestos;
    // Mantener filtro cliente para feedback instantaneo mientras se debounce
    // el server; al confirmarse el server ya devuelve la lista filtrada.
    return repuestos.filter(
      (r) =>
        r.codigo.toLowerCase().includes(q) ||
        r.nombre.toLowerCase().includes(q) ||
        (r.categoria ?? "").toLowerCase().includes(q) ||
        (r.descripcion ?? "").toLowerCase().includes(q),
    );
  })();

  const activos = repuestos.filter((r) => r.activo).length;
  const totalBajoStock = repuestos.filter((r) => r.bajoStock && r.activo).length;
  const totalReservado = repuestos.reduce((acc, r) => acc + r.stockReservado, 0);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (r: Repuesto) => {
    setEditing(r);
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
            <Package className="size-3.5" />
            Insumos del taller
          </div>
          <h1 className="font-semibold text-2xl tracking-tight">Inventario</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
            Repuestos disponibles, stock reservado y movimientos del taller.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar repuestos"
              className="pl-9"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar código, nombre o categoría"
              type="search"
              value={query}
            />
          </div>
          {canManage && (
            <Button onClick={openCreate} size="sm">
              <Plus />
              Agregar repuesto
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-lg border-border/70">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary ring-1 ring-inset ring-brand-primary/20">
              <Package className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
                Repuestos activos
              </p>
              <p className="mt-0.5 font-mono font-semibold text-2xl tabular-nums">
                {activos}
              </p>
            </div>
          </CardContent>
        </Card>
        <button
          aria-pressed={bajoStock}
          className={cn(
            "rounded-lg text-left outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            bajoStock && "ring-2 ring-warning/40",
          )}
          onClick={() => setBajoStock((v) => !v)}
          type="button"
        >
          <Card
            className={cn(
              "rounded-lg border-border/70 transition-colors hover:border-warning/40",
              totalBajoStock > 0 && "border-warning/30 bg-warning/4",
            )}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-warning/12 text-warning-foreground ring-1 ring-inset ring-warning/20">
                <AlertTriangle className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
                  Bajo stock
                </p>
                <p className="mt-0.5 font-mono font-semibold text-2xl text-warning-foreground tabular-nums">
                  {totalBajoStock}
                </p>
              </div>
            </CardContent>
          </Card>
        </button>
        <Card className="rounded-lg border-border/70">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-info/12 text-info-foreground ring-1 ring-inset ring-info/20">
              <PackageCheck className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
                Unidades reservadas
              </p>
              <p className="mt-0.5 font-mono font-semibold text-2xl tabular-nums">
                {totalReservado}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="flex-col items-stretch gap-3 space-y-0 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base">Repuestos registrados</CardTitle>
            <p className="text-muted-foreground text-xs">
              {filtered.length} resultado
              {filtered.length === 1 ? "" : "s"} disponible
              {filtered.length === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Select
              items={[
                { label: "Todas las categorías", value: null },
                ...categoriasDisponibles.map((c) => ({ label: c, value: c })),
              ]}
              onValueChange={(value) =>
                setCategoria((value as string | null) ?? "")
              }
              value={categoria || null}
            >
              <SelectTrigger
                aria-label="Filtrar por categoría"
                className="w-auto min-w-44"
                size="sm"
              >
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todas las categorías</SelectItem>
                {categoriasDisponibles.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex cursor-pointer items-center gap-2 text-muted-foreground text-xs">
              <input
                checked={bajoStock}
                className="size-3.5 accent-brand-primary"
                onChange={(e) => setBajoStock(e.target.checked)}
                type="checkbox"
              />
              Solo bajo stock
            </label>
            {canSeeInactivos && (
              <label className="flex cursor-pointer items-center gap-2 text-muted-foreground text-xs">
                <input
                  checked={includeInactive}
                  className="size-3.5 accent-brand-primary"
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                  type="checkbox"
                />
                Incluir inactivos
              </label>
            )}
            {canSeeMovimientos && (
              <Link
                className="flex items-center gap-1 rounded-sm text-muted-foreground text-xs outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                href="/inventario/movimientos"
              >
                <History className="size-3.5" />
                Ver movimientos
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="space-y-px p-5">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div className="flex items-center gap-4 py-2" key={idx}>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-12" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="No se pudieron cargar los repuestos desde la API. Reintenta en unos segundos."
                title="Error al cargar inventario"
              />
            </div>
          )}

          {!isLoading && !error && repuestos.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="Registra el primer repuesto para iniciar el control de inventario."
                title="No hay repuestos registrados"
              />
              {canManage && (
                <div className="mt-4 flex justify-center">
                  <Button onClick={openCreate}>
                    <Plus />
                    Agregar repuesto
                  </Button>
                </div>
              )}
            </div>
          )}

          {!isLoading && !error && repuestos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3 font-semibold">Código</th>
                    <th className="px-5 py-3 font-semibold">Nombre</th>
                    <th className="px-5 py-3 font-semibold">Categoría</th>
                    <th className="px-5 py-3 font-semibold">Unidad</th>
                    <th className="px-5 py-3 text-right font-semibold">Stock</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Reservado
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Disponible
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">Mínimo</th>
                    {includeInactive && (
                      <th className="px-5 py-3 font-semibold">Estado</th>
                    )}
                    {canManage && (
                      <th className="px-5 py-3 text-right font-semibold">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        className="px-5 py-14 text-center"
                        colSpan={
                          8 + (includeInactive ? 1 : 0) + (canManage ? 1 : 0)
                        }
                      >
                        <EmptyState
                          className="border-0 bg-transparent"
                          icon="search"
                          message="Ajusta la búsqueda o el filtro de bajo stock."
                          title="Sin resultados"
                        />
                      </td>
                    </tr>
                  )}
                  {filtered.map((r) => {
                    const inactive = !r.activo;
                    return (
                      <tr
                        className={cn(
                          "border-border/60 border-b transition-colors last:border-0 hover:bg-secondary/25",
                          inactive && "opacity-60",
                          r.bajoStock && r.activo && "bg-warning/4",
                        )}
                        key={r.id}
                      >
                        <td className="whitespace-nowrap px-5 py-3.5 font-mono font-semibold text-xs">
                          <Link
                            className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            href={`/inventario/repuestos/${r.id}`}
                          >
                            {r.codigo}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 font-medium">
                          <span className="flex items-center gap-1.5">
                            {r.bajoStock && r.activo && (
                              <AlertTriangle
                                aria-label="Bajo stock"
                                className="size-3.5 shrink-0 text-warning-foreground"
                              />
                            )}
                            {r.nombre}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground text-xs">
                          {r.categoria ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground text-xs">
                          {r.unidad}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums">
                          {r.stockActual}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs text-muted-foreground tabular-nums">
                          {r.stockReservado}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <StockDisponibleBadge
                            bajoStock={r.bajoStock}
                            disponible={r.stockDisponible}
                          />
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs text-muted-foreground tabular-nums">
                          {r.stockMinimo}
                        </td>
                        {includeInactive && (
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <Badge variant={inactive ? "outline" : "success"}>
                              {inactive ? "Inactivo" : "Activo"}
                            </Badge>
                          </td>
                        )}
                        {canManage && (
                          <td className="whitespace-nowrap px-5 py-3.5 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                aria-label={`Registrar entrada de ${r.codigo}`}
                                onClick={() => setEntradaTarget(r)}
                                size="icon-sm"
                                title="Registrar entrada"
                                variant="ghost"
                              >
                                <PlusCircle />
                              </Button>
                              <Button
                                aria-label={`Ajustar stock de ${r.codigo}`}
                                onClick={() => setAjusteTarget(r)}
                                size="icon-sm"
                                title="Ajustar stock"
                                variant="ghost"
                              >
                                <Sliders />
                              </Button>
                              <Button
                                aria-label={`Editar ${r.codigo}`}
                                onClick={() => openEdit(r)}
                                size="icon-sm"
                                title="Editar"
                                variant="ghost"
                              >
                                <Pencil />
                              </Button>
                              <Button
                                aria-label={`Desactivar ${r.codigo}`}
                                disabled={inactive}
                                onClick={() => setDesactivarTarget(r)}
                                size="icon-sm"
                                title="Desactivar"
                                variant="destructive-outline"
                              >
                                <PowerOff />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <>
          <RepuestoFormSheet
            onOpenChange={(open) => {
              setFormOpen(open);
              if (!open) setEditing(null);
            }}
            open={formOpen}
            repuesto={editing}
          />
          <EntradaStockDialog
            onOpenChange={(open) => {
              if (!open) setEntradaTarget(null);
            }}
            open={Boolean(entradaTarget)}
            repuesto={entradaTarget}
          />
          <AjusteStockDialog
            onOpenChange={(open) => {
              if (!open) setAjusteTarget(null);
            }}
            open={Boolean(ajusteTarget)}
            repuesto={ajusteTarget}
          />
          <DesactivarRepuestoDialog
            onOpenChange={(open) => {
              if (!open) setDesactivarTarget(null);
            }}
            open={Boolean(desactivarTarget)}
            repuesto={desactivarTarget}
          />
        </>
      )}
    </div>
  );
}
