import Link from "next/link";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
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

async function fetchWithAuth(
  url: string,
  token: string | null,
): Promise<unknown> {
  if (!token) return null;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
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
      <Card>
        <CardHeader>
          <CardTitle>Configuración pendiente</CardTitle>
          <CardDescription>
            La variable <code>NEXT_PUBLIC_API_URL</code> no está configurada.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;

  const ordenesUrl = `${API_BASE_URL}/ordenes`;
  const ticketsUrl = `${API_BASE_URL}/tickets`;

  const [
    ordenesPendiente,
    ordenesEnProceso,
    ordenesCerradas,
    ticketsPendiente,
    ticketsAsignado,
    ticketsEnEjecucion,
    ticketsEjecutado,
    ticketsCerrado,
    ultimasOrdenes,
  ] = await Promise.all([
    countByEstado(ordenesUrl, "PENDIENTE", token),
    countByEstado(ordenesUrl, "EN_PROCESO", token),
    countByEstado(ordenesUrl, "CERRADA", token),
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

  const otActivas = ordenesPendiente + ordenesEnProceso;
  const ticketsActivos =
    ticketsPendiente + ticketsAsignado + ticketsEnEjecucion;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">
          Bienvenido, {profile.fullName || profile.email}.
        </p>
        <h1 className="font-semibold text-2xl tracking-tight">
          Centro de control
        </h1>
        <p className="text-muted-foreground text-sm">
          Resumen operativo del tenant.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<ClipboardList className="size-4 text-muted-foreground" />}
          label="OT activas"
          subline={`${ordenesPendiente} pendientes · ${ordenesEnProceso} en proceso`}
          value={otActivas}
        />
        <KpiCard
          icon={<Wrench className="size-4 text-muted-foreground" />}
          label="Tickets activos"
          subline={`${ticketsPendiente} pend · ${ticketsAsignado} asig · ${ticketsEnEjecucion} ejec`}
          value={ticketsActivos}
        />
        <KpiCard
          icon={<AlertCircle className="size-4 text-amber-500" />}
          label="Pendientes de validar"
          subline="Esperando aprobación del jefe"
          value={ticketsEjecutado}
        />
        <KpiCard
          icon={<CheckCircle2 className="size-4 text-emerald-500" />}
          label="Tickets cerrados"
          subline={`${ordenesCerradas} OTs cerradas`}
          value={ticketsCerrado}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Últimas órdenes</CardTitle>
            <CardDescription>
              Las 5 más recientes creadas en el tenant.
            </CardDescription>
          </div>
          <Button render={<Link href="/ordenes" />} size="sm" variant="ghost">
            Ver todas
          </Button>
        </CardHeader>
        <CardContent>
          {ultimasOrdenes?.data && ultimasOrdenes.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {ultimasOrdenes.data.map((orden) => (
                <li
                  className="flex items-center justify-between gap-3 py-3"
                  key={orden.id}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        className="font-mono font-semibold text-sm hover:underline"
                        href={`/ordenes/${orden.id}`}
                      >
                        {orden.codigo}
                      </Link>
                      <StatusBadge
                        estado={mapOrdenEstado(orden.estado)}
                      />
                      <Badge
                        variant={
                          orden.prioridad === "ALTA" ? "error" : "secondary"
                        }
                      >
                        {orden.prioridad}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-muted-foreground text-xs">
                      {orden.descripcion}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground text-xs">
                    <Clock className="size-3" />
                    {new Date(orden.createdAt).toLocaleDateString("es-CL")}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Activity className="size-4" />
              No hay órdenes registradas todavía.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  subline: string;
}

function KpiCard({ icon, label, value, subline }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="font-semibold text-3xl tracking-tight">{value}</div>
        <p className="mt-1 text-muted-foreground text-xs">{subline}</p>
      </CardContent>
    </Card>
  );
}
