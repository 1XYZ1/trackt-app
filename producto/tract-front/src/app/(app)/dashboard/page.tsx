import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Calendar,
  ClipboardList,
  Download,
  Plus,
  Timer,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const maintenance = [
  {
    equipment: "CAT 793F - CMT-014",
    id: "MNT-2041",
    schedule: "Hoy 14:00",
    status: "programada",
    type: "Preventiva 500h",
  },
  {
    equipment: "Komatsu 930E - CMT-022",
    id: "MNT-2042",
    schedule: "Manana 08:00",
    status: "programada",
    type: "Cambio de filtros",
  },
  {
    equipment: "Sandvik DD422i - JBO-007",
    id: "MNT-2039",
    schedule: "Vencida 2d",
    status: "vencida",
    type: "Inspeccion hidraulica",
  },
  {
    equipment: "Atlas Copco SmartROC",
    id: "MNT-2045",
    schedule: "Vie 09:30",
    status: "programada",
    type: "Lubricacion general",
  },
];

const alerts = [
  {
    message: "Equipo CMT-014 detenido por alta temperatura motor",
    severity: "critica",
    time: "hace 12 min",
  },
  {
    message: "Stock critico - Filtro hidraulico FH-220 (3 uds)",
    severity: "advertencia",
    time: "hace 38 min",
  },
  {
    message: "SLA vencido en OT-1187 (Bomba sumergible)",
    severity: "critica",
    time: "hace 1 h",
  },
  {
    message: "Nueva mantencion programada para CMT-022",
    severity: "info",
    time: "hace 2 h",
  },
];

const fleetHealth = [
  { label: "Operativos", tone: "bg-success", value: 92 },
  { label: "En mantencion", tone: "bg-primary", value: 18 },
  { label: "Detenidos", tone: "bg-destructive", value: 12 },
  { label: "Disponibles", tone: "bg-info", value: 6 },
];

const chartData = [
  { day: "Lun", value: 42 },
  { day: "Mar", value: 58 },
  { day: "Mie", value: 36 },
  { day: "Jue", value: 70 },
  { day: "Vie", value: 88 },
  { day: "Sab", value: 64 },
  { day: "Dom", value: 92 },
];

type KpiTone = "default" | "danger" | "info" | "warning";

const kpis: {
  hint: string;
  icon: LucideIcon;
  label: string;
  tone: KpiTone;
  value: string;
}[] = [
  {
    hint: "+8 vs semana anterior",
    icon: ClipboardList,
    label: "OT activas",
    tone: "info",
    value: "128",
  },
  {
    hint: "33% del total activo",
    icon: Wrench,
    label: "OT en ejecucion",
    tone: "default",
    value: "42",
  },
  {
    hint: "Reposicion urgente",
    icon: Boxes,
    label: "Repuestos criticos",
    tone: "warning",
    value: "7",
  },
  {
    hint: "Vencen en menos de 24h",
    icon: Timer,
    label: "SLA en riesgo",
    tone: "danger",
    value: "5",
  },
];

const kpiToneStyles: Record<KpiTone, string> = {
  danger: "bg-destructive/10 text-destructive ring-destructive/30",
  default: "bg-primary/10 text-primary ring-primary/30",
  info: "bg-info/10 text-info ring-info/30",
  warning: "bg-warning/10 text-warning ring-warning/30",
};

function statusVariant(status: string) {
  if (status === "vencida" || status === "critica") return "error";
  if (status === "advertencia") return "warning";
  if (status === "info") return "info";
  return "success";
}

function KpiCard({
  hint,
  icon: Icon,
  label,
  tone,
  value,
}: {
  hint: string;
  icon: LucideIcon;
  label: string;
  tone: KpiTone;
  value: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className="mt-2 font-mono font-semibold text-2xl text-foreground tabular-nums">
              {value}
            </p>
            <p className="mt-1 text-muted-foreground text-xs">{hint}</p>
          </div>
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-lg ring-1 ring-inset",
              kpiToneStyles[tone],
            )}
          >
            <Icon className="size-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 inline-flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            Operacion en curso - Turno A
          </div>
          <h1 className="font-semibold text-2xl text-foreground tracking-tight">
            Centro de control de mantenimiento
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Vision consolidada de OT, SLA y disponibilidad de repuestos,
            preparada para seguimiento operativo diario.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline">
            <Calendar />
            Hoy - 24 abr
          </Button>
          <Button size="sm" variant="outline">
            <Download />
            Exportar
          </Button>
          <Button size="sm">
            <Plus />
            Nueva OT
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 pb-3">
            <div>
              <CardTitle className="font-semibold text-base">
                Actividad operativa
              </CardTitle>
              <p className="text-muted-foreground text-xs">
                Mantenciones completadas en los ultimos 7 dias
              </p>
            </div>
            <Button className="text-primary" size="sm" variant="ghost">
              Ver detalle
              <ArrowUpRight className="ml-1 size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-end gap-3">
              {chartData.map((item) => (
                <div
                  className="flex flex-1 flex-col items-center gap-2"
                  key={item.day}
                >
                  <div className="relative flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-md bg-gradient-to-t from-primary/70 to-primary/30 ring-1 ring-primary/30"
                      style={{ height: `${item.value}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {item.day}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="font-semibold text-base">
              Salud de flota
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              Distribucion por estado operacional
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {fleetHealth.map((item) => (
              <div className="space-y-1.5" key={item.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-mono font-medium">{item.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn("h-full", item.tone)}
                    style={{ width: `${(item.value / 128) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 pb-3">
            <CardTitle className="font-semibold text-base">
              Proximas mantenciones
            </CardTitle>
            <Button className="text-primary" size="sm" variant="ghost">
              Ver todas
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {maintenance.map((item) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2.5 transition-colors hover:border-primary/30"
                key={item.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Wrench className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge
                        className="font-mono font-normal text-[10px] text-muted-foreground"
                        variant="outline"
                      >
                        {item.id}
                      </Badge>
                      <span className="truncate font-medium text-sm">
                        {item.equipment}
                      </span>
                    </div>
                    <p className="truncate text-muted-foreground text-xs">
                      {item.type}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-muted-foreground text-xs">
                    {item.schedule}
                  </span>
                  <Badge variant={statusVariant(item.status)}>
                    {item.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 font-semibold text-base">
              <Activity className="size-4 text-primary" />
              Alertas recientes
            </CardTitle>
            <Button className="text-primary" size="sm" variant="ghost">
              Centro de alertas
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert) => (
              <div
                className="flex items-start gap-3 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2.5"
                key={`${alert.message}-${alert.time}`}
              >
                <AlertTriangle
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    alert.severity === "critica"
                      ? "text-destructive"
                      : alert.severity === "advertencia"
                        ? "text-warning"
                        : "text-info",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{alert.message}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={statusVariant(alert.severity)}>
                      {alert.severity}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {alert.time}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
