import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  PlayCircle,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/core";
import type { TracktEstado } from "@/components/core";
import type { SessionProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { FlujoChart, type FlujoChartDatum } from "./flujo-chart";

interface Props {
  profile: SessionProfile;
}

type PaginatedMeta = { total: number };

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Backend OT estado → frontend
function mapOrdenEstado(estado: string): TracktEstado {
  const map: Record<string, TracktEstado> = {
    PENDIENTE: "PENDIENTE",
    EN_PROCESO: "EN_EJECUCION",
    CERRADA: "CERRADO",
    CANCELADA: "CANCELADO",
  };
  return (map[estado] ?? "PENDIENTE") as TracktEstado;
}

// Lanza ante cualquier fallo (token nulo, !ok, red). El llamador distingue
// "error real" de "cero legítimo" — antes ambos se pintaban como 0.
async function fetchWithAuth(
  url: string,
  token: string | null,
): Promise<unknown> {
  if (!token) throw new Error("Sesion no valida");
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Error ${res.status} al consultar el resumen`);
  }
  return res.json();
}

async function countByEstado(
  base: string,
  estado: string,
  token: string | null,
): Promise<number> {
  const result = (await fetchWithAuth(
    `${base}?estado=${estado}&limit=1`,
    token,
  )) as { meta?: PaginatedMeta } | null;
  return result?.meta?.total ?? 0;
}

export async function DashboardAdmin({ profile }: Props) {
  if (!API_BASE_URL) {
    return (
      <Card className="border-warning/40 bg-warning/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="size-4 text-warning-foreground" />
            Configuración pendiente
          </CardTitle>
          <CardDescription>
            La variable <code>NEXT_PUBLIC_API_URL</code> no está configurada.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const supabase = await createClient();
  // La página ya pasó el guard del layout (requireSession valida el usuario vía
  // getUser) y la API revalida el Bearer en cada request, así que aquí basta
  // getSession (lee cookies, sin round-trip al auth server) para tomar el token.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;

  const ordenesUrl = `${API_BASE_URL}/ordenes`;
  const ticketsUrl = `${API_BASE_URL}/tickets`;

  let kpis: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    {
      data?: Array<{
        id: string;
        codigo: string;
        descripcion: string;
        estado: string;
        prioridad: string;
        createdAt: string;
      }>;
    } | null,
  ];
  try {
    kpis = await Promise.all([
      countByEstado(ordenesUrl, "PENDIENTE", token),
      countByEstado(ordenesUrl, "EN_PROCESO", token),
      countByEstado(ticketsUrl, "PENDIENTE", token),
      countByEstado(ticketsUrl, "ASIGNADO", token),
      countByEstado(ticketsUrl, "EN_EJECUCION", token),
      countByEstado(ticketsUrl, "EJECUTADO", token),
      countByEstado(ticketsUrl, "CERRADO", token),
      fetchWithAuth(`${ordenesUrl}?limit=5&page=1`, token) as Promise<{
        data?: Array<{
          id: string;
          codigo: string;
          descripcion: string;
          estado: string;
          prioridad: string;
          createdAt: string;
        }>;
      } | null>,
    ]);
  } catch {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="size-4 text-destructive" />
            No se pudo cargar el resumen
          </CardTitle>
          <CardDescription>
            Hubo un problema al consultar la API. Recarga la página; si persiste,
            revisa tu sesión.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const [
    ordenesPendiente,
    ordenesEnProceso,
    ticketsPendiente,
    ticketsAsignado,
    ticketsEnEjecucion,
    ticketsEjecutado,
    ticketsCerrado,
    ultimasOrdenes,
  ] = kpis;

  const otActivas = ordenesPendiente + ordenesEnProceso;
  const ticketsActivos =
    ticketsPendiente + ticketsAsignado + ticketsEnEjecucion;

  const flujoData: FlujoChartDatum[] = [
    {
      color: "var(--estado-pendiente-dot)",
      estado: "PENDIENTE",
      label: "Pend.",
      value: ticketsPendiente,
    },
    {
      color: "var(--estado-asignado-dot)",
      estado: "ASIGNADO",
      label: "Asig.",
      value: ticketsAsignado,
    },
    {
      color: "var(--estado-en-ejecucion-dot)",
      estado: "EN_EJECUCION",
      label: "Ejec.",
      value: ticketsEnEjecucion,
    },
    {
      color: "var(--estado-ejecutado-dot)",
      estado: "EJECUTADO",
      label: "A validar",
      value: ticketsEjecutado,
    },
    {
      color: "var(--estado-cerrado-dot)",
      estado: "CERRADO",
      label: "Cerrados",
      value: ticketsCerrado,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground text-sm">
            Bienvenido, {profile.fullName || profile.email}.
          </p>
          <h1 className="font-semibold text-2xl tracking-tight">
            Centro de control
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Resumen operativo del tenant en tiempo real.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            render={<Link href="/ordenes" />}
            size="sm"
            variant="outline"
          >
            <ClipboardList />
            Órdenes
          </Button>
          <Button render={<Link href="/tickets" />} size="sm" variant="outline">
            <Wrench />
            Tickets
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          accent="brand"
          href="/ordenes"
          icon={<ClipboardList className="size-4.5" />}
          label="OT activas"
          subline={`${ordenesPendiente} pendientes · ${ordenesEnProceso} en proceso`}
          value={otActivas}
        />
        <KpiCard
          accent="info"
          href="/tickets"
          icon={<PlayCircle className="size-4.5" />}
          label="Tickets activos"
          subline={`${ticketsPendiente} pend · ${ticketsAsignado} asig · ${ticketsEnEjecucion} ejec`}
          value={ticketsActivos}
        />
        <KpiCard
          accent="warning"
          href="/tickets"
          icon={<AlertCircle className="size-4.5" />}
          label="Pendientes de validar"
          subline="Esperando aprobación del jefe"
          value={ticketsEjecutado}
        />
        <KpiCard
          accent="success"
          icon={<CheckCircle2 className="size-4.5" />}
          label="Tickets cerrados"
          subline="Validados y cerrados"
          value={ticketsCerrado}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Flujo de tickets</CardTitle>
            <CardDescription>
              Distribución por etapa del workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <FlujoChart data={flujoData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Últimas órdenes</CardTitle>
              <CardDescription>
                Las 5 más recientes creadas en el tenant.
              </CardDescription>
            </div>
            <Button
              render={<Link href="/ordenes" />}
              size="sm"
              variant="ghost"
            >
              Ver todas
              <ArrowRight />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {ultimasOrdenes?.data && ultimasOrdenes.data.length > 0 ? (
              <ul className="-mx-2 divide-y divide-border">
                {ultimasOrdenes.data.map((orden) => (
                  <li key={orden.id}>
                    <Link
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                      href={`/ordenes/${orden.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-semibold text-sm">
                            {orden.codigo}
                          </span>
                          <StatusBadge estado={mapOrdenEstado(orden.estado)} />
                          {orden.prioridad === "ALTA" && (
                            <Badge variant="error">Alta</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-muted-foreground text-xs">
                          {orden.descripcion}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
                        <Clock className="size-3" />
                        {new Date(orden.createdAt).toLocaleDateString("es-CL")}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
                <div className="flex size-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/20 ring-inset">
                  <ClipboardList className="size-5" />
                </div>
                <p className="text-muted-foreground text-sm">
                  No hay órdenes registradas todavía.
                </p>
                <Button
                  render={<Link href="/ordenes" />}
                  size="sm"
                  variant="outline"
                >
                  Crear primera OT
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  subline: string;
  accent: "brand" | "info" | "warning" | "success";
  href?: string;
}

const ACCENT_STYLES: Record<
  KpiCardProps["accent"],
  { chip: string; ring: string }
> = {
  brand: {
    chip: "bg-brand-primary/10 text-brand-primary",
    ring: "ring-brand-primary/20",
  },
  info: {
    chip: "bg-info/10 text-info-foreground",
    ring: "ring-info/20",
  },
  success: {
    chip: "bg-success/10 text-success-foreground",
    ring: "ring-success/20",
  },
  warning: {
    chip: "bg-warning/10 text-warning-foreground",
    ring: "ring-warning/20",
  },
};

function KpiCard({ accent, href, icon, label, subline, value }: KpiCardProps) {
  const styles = ACCENT_STYLES[accent];
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-muted-foreground text-sm">{label}</p>
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-lg ring-1 ring-inset",
            styles.chip,
            styles.ring,
          )}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 font-semibold text-3xl tabular-nums tracking-tight">
        {value}
      </div>
      <p className="mt-1 text-muted-foreground text-xs">{subline}</p>
    </>
  );

  if (href) {
    return (
      <Card className="transition-colors hover:border-brand-primary/40">
        <Link
          className="block rounded-2xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          href={href}
        >
          {body}
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5">{body}</CardContent>
    </Card>
  );
}
