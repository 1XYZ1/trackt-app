"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Package,
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
} from "@/components/inventario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useHasRole } from "@/contexts/auth-context";
import { useRepuestos } from "@/hooks/use-inventario";
import type { Repuesto } from "@/lib/api/inventario";

export function InventarioClient() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [bajoStock, setBajoStock] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Repuesto | null>(null);
  const [entradaTarget, setEntradaTarget] = useState<Repuesto | null>(null);
  const [ajusteTarget, setAjusteTarget] = useState<Repuesto | null>(null);
  const [desactivarTarget, setDesactivarTarget] = useState<Repuesto | null>(null);

  const isAdmin = useHasRole("admin");
  // admin y jefe_taller pueden ver inactivos (backend permite a ambos).
  const canSeeInactivos = useHasRole("admin", "jefe_taller");

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
  });

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

  const totalBajoStock = repuestos.filter((r) => r.bajoStock && r.activo).length;

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
              className="pl-7"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar codigo, nombre o categoria"
              type="search"
              value={query}
            />
          </div>
          {isAdmin && (
            <Button onClick={openCreate} size="sm">
              <Plus />
              Agregar repuesto
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-lg border-border/70">
          <CardContent className="p-4">
            <p className="font-medium text-[11px] text-muted-foreground uppercase">
              Repuestos activos
            </p>
            <p className="mt-2 font-mono font-semibold text-2xl">
              {repuestos.filter((r) => r.activo).length}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-border/70">
          <CardContent className="p-4">
            <p className="font-medium text-[11px] text-muted-foreground uppercase">
              Bajo stock
            </p>
            <p className="mt-2 flex items-center gap-2 font-mono font-semibold text-2xl text-warning">
              <AlertTriangle className="size-5" />
              {totalBajoStock}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-border/70">
          <CardContent className="p-4">
            <p className="font-medium text-[11px] text-muted-foreground uppercase">
              Unidades reservadas
            </p>
            <p className="mt-2 font-mono font-semibold text-2xl">
              {repuestos.reduce((acc, r) => acc + r.stockReservado, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Repuestos registrados</CardTitle>
            <p className="text-muted-foreground text-xs">
              {filtered.length} resultado
              {filtered.length === 1 ? "" : "s"} disponibles.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-muted-foreground text-xs">
              <input
                checked={bajoStock}
                className="size-3.5"
                onChange={(e) => setBajoStock(e.target.checked)}
                type="checkbox"
              />
              Solo bajo stock
            </label>
            {canSeeInactivos && (
              <label className="flex items-center gap-2 text-muted-foreground text-xs">
                <input
                  checked={includeInactive}
                  className="size-3.5"
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                  type="checkbox"
                />
                Incluir inactivos
              </label>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center gap-2 px-5 py-16 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando repuestos...
            </div>
          )}

          {!isLoading && error && (
            <div className="p-5">
              <EmptyState
                icon="wrench"
                message="No se pudieron cargar los repuestos desde la API."
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
              {isAdmin && (
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
                    <th className="px-5 py-3 font-semibold">Codigo</th>
                    <th className="px-5 py-3 font-semibold">Nombre</th>
                    <th className="px-5 py-3 font-semibold">Categoria</th>
                    <th className="px-5 py-3 font-semibold">Unidad</th>
                    <th className="px-5 py-3 text-right font-semibold">Stock</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Reservado
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Disponible
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">Minimo</th>
                    {includeInactive && (
                      <th className="px-5 py-3 font-semibold">Estado</th>
                    )}
                    {isAdmin && (
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
                          8 + (includeInactive ? 1 : 0) + (isAdmin ? 1 : 0)
                        }
                      >
                        <EmptyState
                          className="border-0 bg-transparent"
                          icon="search"
                          message="Ajusta la busqueda o el filtro de bajo stock."
                          title="Sin resultados"
                        />
                      </td>
                    </tr>
                  )}
                  {filtered.map((r) => {
                    const inactive = !r.activo;
                    return (
                      <tr
                        className="border-border/60 border-b transition-colors last:border-0 hover:bg-secondary/25"
                        key={r.id}
                      >
                        <td className="whitespace-nowrap px-5 py-3.5 font-mono font-semibold text-xs">
                          {r.codigo}
                        </td>
                        <td className="px-5 py-3.5 font-medium">{r.nombre}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground text-xs">
                          {r.categoria ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground text-xs">
                          {r.unidad}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs">
                          {r.stockActual}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs">
                          {r.stockReservado}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Badge variant={r.bajoStock ? "error" : "secondary"}>
                            {r.stockDisponible}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs text-muted-foreground">
                          {r.stockMinimo}
                        </td>
                        {includeInactive && (
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <Badge variant={inactive ? "outline" : "default"}>
                              {inactive ? "Inactivo" : "Activo"}
                            </Badge>
                          </td>
                        )}
                        {isAdmin && (
                          <td className="whitespace-nowrap px-5 py-3.5 text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                onClick={() => setEntradaTarget(r)}
                                size="sm"
                                title="Registrar entrada"
                                variant="ghost"
                              >
                                <PlusCircle />
                              </Button>
                              <Button
                                onClick={() => setAjusteTarget(r)}
                                size="sm"
                                title="Ajustar stock"
                                variant="ghost"
                              >
                                <Sliders />
                              </Button>
                              <Button
                                onClick={() => openEdit(r)}
                                size="sm"
                                title="Editar"
                                variant="ghost"
                              >
                                <Pencil />
                              </Button>
                              <Button
                                disabled={inactive}
                                onClick={() => setDesactivarTarget(r)}
                                size="sm"
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

      {isAdmin && (
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
