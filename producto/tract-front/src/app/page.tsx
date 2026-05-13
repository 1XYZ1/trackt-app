import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  Lock,
  Search,
  ShieldCheck,
  Timer,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Truck, label: "Equipos" },
  { icon: Wrench, label: "Mantenciones" },
  { icon: ClipboardList, label: "Ordenes" },
  { icon: AlertTriangle, label: "Alertas" },
  { icon: Users, label: "Usuarios" },
];

const kpis = [
  {
    icon: ClipboardList,
    label: "OT activas",
    tone: "text-info bg-info/10 ring-info/30",
    value: "128",
  },
  {
    icon: Truck,
    label: "Disponibilidad",
    tone: "text-success bg-success/10 ring-success/30",
    value: "91%",
  },
  {
    icon: Boxes,
    label: "Stock critico",
    tone: "text-warning bg-warning/10 ring-warning/30",
    value: "7",
  },
  {
    icon: Timer,
    label: "SLA en riesgo",
    tone: "text-destructive bg-destructive/10 ring-destructive/30",
    value: "5",
  },
];

const tableRows = [
  {
    code: "OT-10482",
    equipment: "Camion CAT 797F",
    owner: "M. Castillo",
    priority: "Alta",
    sla: "04:12 h",
    status: "En ejecucion",
  },
  {
    code: "OT-10481",
    equipment: "Pala Komatsu PC8000",
    owner: "Bodega Central",
    priority: "Alta",
    sla: "-01:20 h",
    status: "Pendiente stock",
  },
  {
    code: "OT-10479",
    equipment: "Cargador frontal 994K",
    owner: "F. Aravena",
    priority: "Media",
    sla: "12:40 h",
    status: "En validacion",
  },
  {
    code: "OT-10470",
    equipment: "Motoniveladora 24M",
    owner: "R. Soto",
    priority: "Media",
    sla: "OK",
    status: "Cerrada",
  },
];

const modules = [
  {
    description: "Vista ejecutiva de OT, flota, SLA y alertas operativas.",
    icon: LayoutDashboard,
    label: "Dashboard",
  },
  {
    description: "Inventario visual de equipos, ubicaciones y horometros.",
    icon: Truck,
    label: "Equipos",
  },
  {
    description: "Planificacion preventiva, correctiva y vencimientos.",
    icon: Wrench,
    label: "Mantenciones",
  },
  {
    description: "Seguimiento de ordenes con responsables y SLA.",
    icon: ClipboardList,
    label: "Ordenes",
  },
  {
    description: "Centro de eventos criticos, advertencias y stock.",
    icon: Bell,
    label: "Alertas",
  },
  {
    description: "Roles, permisos y trazabilidad de usuarios.",
    icon: ShieldCheck,
    label: "Administracion",
  },
];

const palette = [
  { className: "bg-background", label: "Background", value: "base" },
  { className: "bg-card", label: "Card", value: "surface" },
  { className: "bg-primary", label: "Primary", value: "accion" },
  { className: "bg-success", label: "Success", value: "operativo" },
  { className: "bg-warning", label: "Warning", value: "riesgo" },
  { className: "bg-destructive", label: "Danger", value: "critico" },
  { className: "bg-info", label: "Info", value: "evento" },
  { className: "bg-muted", label: "Muted", value: "neutro" },
];

const componentCards = [
  {
    detail: "KPIs compactos con icono, valor, contexto y color semantico.",
    title: "Summary cards",
  },
  {
    detail: "Tablas densas con estados, responsables, prioridad y acciones.",
    title: "Operational tables",
  },
  {
    detail: "Badges para SLA, estado de equipo, criticidad y progreso.",
    title: "Status system",
  },
  {
    detail: "Layouts responsive con sidebar, header y contenido modular.",
    title: "App shell",
  },
];

function IconBox({ className, icon: Icon }: { className?: string; icon: LucideIcon }) {
  return (
    <div
      className={cn(
        "flex size-10 items-center justify-center rounded-lg ring-1 ring-inset",
        className,
      )}
    >
      <Icon className="size-4" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "Cerrada"
      ? "bg-success/10 text-success ring-success/30"
      : status === "Pendiente stock"
        ? "bg-warning/10 text-warning ring-warning/30"
        : status === "En ejecucion"
          ? "bg-primary/10 text-primary ring-primary/30"
          : "bg-secondary text-secondary-foreground ring-border";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 font-semibold text-[11px] ring-1 ring-inset",
        styles,
      )}
    >
      {status}
    </span>
  );
}

function DemoSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-white/10 border-r bg-black/20 p-4 lg:block">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-cyan-500/20 shadow-lg">
          <Activity className="size-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-white">Trackt</p>
          <p className="text-[11px] text-zinc-500">System Design</p>
        </div>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => (
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
              item.active
                ? "bg-white/10 text-white"
                : "text-zinc-400 hover:bg-white/5 hover:text-white",
            )}
            key={item.label}
          >
            <item.icon className="size-4" />
            {item.label}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f14] shadow-2xl shadow-black/50">
      <div className="flex min-h-[680px]">
        <DemoSidebar />
        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-white/10 border-b px-5 py-4">
            <div className="relative hidden sm:block">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-zinc-500" />
              <div className="h-9 w-72 rounded-lg border border-white/10 bg-white/[0.03] pl-10 text-sm text-zinc-500 leading-9">
                Buscar equipo, OT o responsable
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge className="bg-emerald-500/10 text-emerald-400" variant="secondary">
                Turno A activo
              </Badge>
              <Button size="sm">
                <ArrowRight />
                Demo
              </Button>
            </div>
          </header>

          <main className="space-y-5 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="mb-1 font-medium text-[11px] text-cyan-400 uppercase tracking-[0.18em]">
                  Operacion minera
                </p>
                <h2 className="font-semibold text-2xl text-white">
                  Centro de control de mantenimiento
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Vision consolidada de flota, OT, SLA y repuestos criticos.
                </p>
              </div>
              <Button size="sm" variant="outline">
                Nueva OT
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {kpis.map((kpi) => (
                <Card className="border-white/10 bg-white/[0.03]" key={kpi.label}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] text-zinc-500 uppercase">
                          {kpi.label}
                        </p>
                        <p className="mt-2 font-mono font-semibold text-2xl text-white">
                          {kpi.value}
                        </p>
                      </div>
                      <IconBox className={kpi.tone} icon={kpi.icon} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-white/10 bg-white/[0.03]">
                <CardHeader>
                  <CardTitle className="text-base text-white">
                    Actividad semanal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex h-44 items-end gap-3">
                    {[42, 58, 36, 70, 88, 64, 92].map((height, index) => (
                      <div className="flex flex-1 flex-col items-center gap-2" key={index}>
                        <div
                          className="w-full rounded-md bg-gradient-to-t from-cyan-500/70 to-blue-500/25 ring-1 ring-cyan-400/20"
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-[10px] text-zinc-500">
                          {["L", "M", "M", "J", "V", "S", "D"][index]}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/[0.03]">
                <CardHeader>
                  <CardTitle className="text-base text-white">
                    Salud de flota
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    ["Operativos", 92, "bg-emerald-500"],
                    ["En mantencion", 18, "bg-cyan-500"],
                    ["Detenidos", 12, "bg-red-500"],
                    ["Disponibles", 6, "bg-blue-500"],
                  ].map(([label, value, color]) => (
                    <div className="space-y-1.5" key={label}>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-400">{label}</span>
                        <span className="font-mono text-white">{value}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={cn("h-full", color as string)}
                          style={{ width: `${(Number(value) / 128) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="border-white/10 bg-white/[0.03]">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base text-white">
                  Tabla operacional
                </CardTitle>
                <Badge variant="outline">Tiempo real</Badge>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-white/10 border-b text-left text-[11px] text-zinc-500 uppercase">
                      <th className="py-3 pr-4">OT</th>
                      <th className="py-3 pr-4">Equipo</th>
                      <th className="py-3 pr-4">Estado</th>
                      <th className="py-3 pr-4">Responsable</th>
                      <th className="py-3 pr-4">SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr className="border-white/5 border-b last:border-0" key={row.code}>
                        <td className="py-3 pr-4 font-mono text-cyan-300">
                          {row.code}
                        </td>
                        <td className="py-3 pr-4 text-zinc-200">
                          {row.equipment}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="py-3 pr-4 text-zinc-400">{row.owner}</td>
                        <td className="py-3 pr-4 font-mono text-zinc-200">
                          {row.sla}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#070b10] text-white">
      <section className="relative overflow-hidden border-white/10 border-b">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:36px_36px] opacity-40" />
        <div className="pointer-events-none absolute -top-40 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-12 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-cyan-500/20 shadow-lg">
                <Activity className="size-5 text-white" />
              </div>
              <div>
                <p className="font-semibold">Trackt</p>
                <p className="text-[11px] text-zinc-500">System Design</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button render={<Link href="/login" />} size="sm" variant="outline">
                Login
              </Button>
              <Button render={<Link href="/dashboard" />} size="sm">
                Ver demo
              </Button>
            </div>
          </header>

          <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <Badge className="mb-5 border-cyan-400/20 bg-cyan-400/10 text-cyan-300" variant="outline">
                SaaS industrial para mantenimiento minero
              </Badge>
              <h1 className="max-w-3xl font-semibold text-4xl tracking-tight sm:text-5xl">
                Plataforma visual para operar flota, mantenciones y ordenes de trabajo.
              </h1>
              <p className="mt-5 max-w-2xl text-base text-zinc-400 leading-7">
                Trackt define una experiencia oscura, robusta y profesional para
                equipos de mantenimiento: dashboards, KPIs, tablas operacionales,
                alertas, estados y componentes listos para escalar.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button render={<Link href="#system" />} size="lg">
                  Ver system design
                  <ArrowRight />
                </Button>
                <Button render={<Link href="/ordenes" />} size="lg" variant="outline">
                  Pantalla de ordenes
                </Button>
              </div>
            </div>

            <DashboardPreview />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" id="system">
        <div className="mb-8 flex flex-col gap-2">
          <p className="font-medium text-[11px] text-cyan-400 uppercase tracking-[0.18em]">
            Modulos base
          </p>
          <h2 className="font-semibold text-2xl tracking-tight">
            Estructura profesional del frontend
          </h2>
          <p className="max-w-2xl text-sm text-zinc-400">
            Pantallas y patrones preparados para una plataforma SaaS real:
            navegacion, control operacional, estados y lectura rapida.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <Card className="border-white/10 bg-white/[0.03]" key={module.label}>
              <CardContent className="p-5">
                <IconBox className="mb-4 bg-cyan-400/10 text-cyan-300 ring-cyan-400/25" icon={module.icon} />
                <h3 className="font-semibold text-white">{module.label}</h3>
                <p className="mt-2 text-sm text-zinc-400">{module.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-white/10 border-y bg-white/[0.02]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:px-8">
          <div>
            <p className="font-medium text-[11px] text-cyan-400 uppercase tracking-[0.18em]">
              Paleta
            </p>
            <h2 className="mt-2 font-semibold text-2xl tracking-tight">
              Colores por funcion operativa
            </h2>
            <p className="mt-3 text-sm text-zinc-400 leading-6">
              Cada color comunica una condicion: operativo, riesgo, evento,
              accion o criticidad. La interfaz se mantiene sobria y legible.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {palette.map((color) => (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3" key={color.label}>
                <div className={cn("mb-3 h-16 rounded-lg border border-white/10", color.className)} />
                <p className="font-medium text-sm">{color.label}</p>
                <p className="text-xs text-zinc-500">{color.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-2">
          <p className="font-medium text-[11px] text-cyan-400 uppercase tracking-[0.18em]">
            Componentes del sistema
          </p>
          <h2 className="font-semibold text-2xl tracking-tight">
            Bloques visuales reutilizables
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {componentCards.map((item) => (
            <Card className="border-white/10 bg-white/[0.03]" key={item.title}>
              <CardContent className="p-5">
                <CheckCircle2 className="mb-4 size-5 text-success" />
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{item.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <Card className="overflow-hidden border-cyan-400/20 bg-cyan-400/5">
          <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-cyan-300 text-sm">
                <Lock className="size-4" />
                Preparado para GitHub y Vercel
              </div>
              <h2 className="font-semibold text-2xl">
                Demo lista para publicar como plataforma SaaS.
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Next.js, TypeScript, Tailwind, shadcn/ui, layout responsive y
                rutas demo para presentar el sistema.
              </p>
            </div>
            <Button render={<Link href="/dashboard" />} size="lg">
              Abrir dashboard
              <Gauge />
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
