"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, Table2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useHasRole } from "@/contexts/auth-context";
import {
  descargarReporteCsv,
  getReporteJson,
  type ReporteFiltros,
} from "@/lib/api/reportes";
import { cn } from "@/lib/utils";

type FiltroKey = "desde" | "hasta" | "estado" | "vista" | "soloCriticos";

type ReporteDef = {
  key: string;
  label: string;
  path: string;
  filenameBase: string;
  filtros: FiltroKey[];
  estadoOpciones?: string[];
  vistaOpciones?: string[];
};

const REPORTES: ReporteDef[] = [
  { filenameBase: "reporte-equipos", filtros: [], key: "equipos", label: "Equipos", path: "/reportes/equipos" },
  {
    estadoOpciones: ["PENDIENTE", "EN_PROCESO", "CERRADA", "CANCELADA"],
    filenameBase: "reporte-ordenes",
    filtros: ["desde", "hasta", "estado"],
    key: "ordenes",
    label: "Órdenes",
    path: "/reportes/ordenes",
  },
  {
    estadoOpciones: [
      "PENDIENTE",
      "ASIGNADO",
      "EN_EJECUCION",
      "EJECUTADO",
      "CERRADO",
      "CANCELADO",
    ],
    filenameBase: "reporte-tickets",
    filtros: ["desde", "hasta", "estado"],
    key: "tickets",
    label: "Tickets",
    path: "/reportes/tickets",
  },
  {
    filenameBase: "reporte-inventario",
    filtros: ["vista", "soloCriticos"],
    key: "inventario",
    label: "Inventario",
    path: "/reportes/inventario",
    vistaOpciones: ["stock", "consumos"],
  },
  {
    estadoOpciones: ["PROGRAMADA", "GENERADA", "CANCELADA", "VENCIDA", "COMPLETADA"],
    filenameBase: "reporte-mantenimientos",
    filtros: ["vista", "desde", "hasta", "estado"],
    key: "mantenimientos",
    label: "Mantenimientos",
    path: "/reportes/mantenimientos",
    vistaOpciones: ["todos", "vencidos", "proximos"],
  },
];

export function ReportesClient() {
  const isAdmin = useHasRole("admin");
  const isJefe = useHasRole("jefe_taller");
  const canView = isAdmin || isJefe;

  const [selectedKey, setSelectedKey] = useState("equipos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [estado, setEstado] = useState("");
  const [vista, setVista] = useState("");
  const [soloCriticos, setSoloCriticos] = useState(false);
  const [ran, setRan] = useState<{ path: string; filtros: ReporteFiltros } | null>(
    null,
  );
  const [downloading, setDownloading] = useState(false);

  const def = REPORTES.find((r) => r.key === selectedKey) ?? REPORTES[0];

  const selectReport = (key: string) => {
    setSelectedKey(key);
    setEstado("");
    setDesde("");
    setHasta("");
    setSoloCriticos(false);
    const next = REPORTES.find((r) => r.key === key);
    setVista(next?.vistaOpciones?.[0] ?? "");
    setRan(null);
  };

  const buildFiltros = (): ReporteFiltros => {
    const f: ReporteFiltros = {};
    if (def.filtros.includes("desde") && desde) f.desde = desde;
    if (def.filtros.includes("hasta") && hasta) f.hasta = hasta;
    if (def.filtros.includes("estado") && estado) f.estado = estado;
    if (def.filtros.includes("vista") && vista) f.vista = vista;
    if (def.filtros.includes("soloCriticos") && soloCriticos)
      f.soloCriticos = true;
    return f;
  };

  const query = useQuery({
    enabled: Boolean(ran),
    queryFn: () => getReporteJson(ran!.path, ran!.filtros),
    queryKey: ["reportes", ran?.path, ran?.filtros],
  });

  const handleVer = () => setRan({ filtros: buildFiltros(), path: def.path });

  const handleCsv = async () => {
    setDownloading(true);
    try {
      await descargarReporteCsv(
        def.path,
        buildFiltros(),
        `${def.filenameBase}.csv`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo descargar el CSV",
      );
    } finally {
      setDownloading(false);
    }
  };

  if (!canView) {
    return (
      <Card>
        <CardContent className="p-5">
          <EmptyState
            icon="inbox"
            message="Los reportes están disponibles solo para administradores y jefes de taller."
            title="Acceso restringido"
          />
        </CardContent>
      </Card>
    );
  }

  const rows = query.data?.data ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
          <BarChart3 className="size-3.5" />
          Administración
        </div>
        <h1 className="font-semibold text-2xl tracking-tight">Reportes</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
          Consulta y exporta reportes operativos en CSV.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tipo de reporte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            aria-label="Tipo de reporte"
            className="flex flex-wrap gap-1.5"
            role="group"
          >
            {REPORTES.map((r) => (
              <button
                aria-pressed={selectedKey === r.key}
                className={cn(
                  "rounded-full border px-3 py-1 font-medium text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                  selectedKey === r.key
                    ? "border-brand-primary/50 bg-brand-primary/10 text-brand-primary"
                    : "border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
                key={r.key}
                onClick={() => selectReport(r.key)}
                type="button"
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {def.filtros.includes("desde") && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground uppercase">
                  Desde
                </label>
                <Input
                  className="w-40"
                  onChange={(e) => setDesde(e.target.value)}
                  type="date"
                  value={desde}
                />
              </div>
            )}
            {def.filtros.includes("hasta") && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground uppercase">
                  Hasta
                </label>
                <Input
                  className="w-40"
                  onChange={(e) => setHasta(e.target.value)}
                  type="date"
                  value={hasta}
                />
              </div>
            )}
            {def.filtros.includes("vista") && def.vistaOpciones && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground uppercase">
                  Vista
                </label>
                <Select
                  items={def.vistaOpciones.map((v) => ({ label: v, value: v }))}
                  onValueChange={(value) => setVista((value as string) ?? "")}
                  value={vista || null}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {def.vistaOpciones.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {def.filtros.includes("estado") && def.estadoOpciones && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground uppercase">
                  Estado
                </label>
                <Select
                  items={[
                    { label: "Todos", value: null },
                    ...def.estadoOpciones.map((e) => ({ label: e, value: e })),
                  ]}
                  onValueChange={(value) =>
                    setEstado((value as string | null) ?? "")
                  }
                  value={estado || null}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todos</SelectItem>
                    {def.estadoOpciones.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {def.filtros.includes("soloCriticos") && vista === "stock" && (
              <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
                <Switch
                  checked={soloCriticos}
                  onCheckedChange={setSoloCriticos}
                />
                Solo críticos
              </label>
            )}

            <div className="flex gap-2">
              <Button onClick={handleVer} variant="outline">
                <Table2 />
                Ver
              </Button>
              <Button loading={downloading} onClick={handleCsv}>
                <Download />
                Descargar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Resultado{query.data ? ` (${query.data.total})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!ran && (
            <div className="p-5">
              <EmptyState
                icon="search"
                message="Selecciona un reporte y pulsa Ver para previsualizar, o descarga el CSV."
                title="Sin datos cargados"
              />
            </div>
          )}
          {ran && query.isLoading && (
            <div className="space-y-2.5 p-5">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton className="h-8 w-full" key={idx} />
              ))}
            </div>
          )}
          {ran && query.error && (
            <div className="p-5">
              <EmptyState
                icon="inbox"
                message="No se pudo cargar el reporte. Revisa los filtros o la conexión."
                title="Error al cargar"
              />
            </div>
          )}
          {ran && !query.isLoading && !query.error && rows.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon="inbox"
                message="El reporte no devolvió filas para los filtros seleccionados."
                title="Sin resultados"
              />
            </div>
          )}
          {ran && rows.length > 0 && (
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-border border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                    {columns.map((c) => (
                      <th
                        className="whitespace-nowrap px-4 py-3 font-semibold"
                        key={c}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      className="border-border/60 border-b transition-colors last:border-0 odd:bg-secondary/15 hover:bg-accent/40"
                      key={idx}
                    >
                      {columns.map((c) => (
                        <td className="whitespace-nowrap px-4 py-2.5" key={c}>
                          {row[c] === null || row[c] === undefined
                            ? "—"
                            : String(row[c])}
                        </td>
                      ))}
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
