import type { Metadata } from "next";
import {
  EmptyState,
  OtCard,
  StatusBadge,
  TicketCard,
  TimelineItem,
  UserAvatar,
  type OtResumen,
  type TicketEstado,
  type TicketResumen,
  type TimelineEvento,
  type UsuarioResumen,
} from "@/components/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Componentes Core | Trackt",
  description: "Vista interna de componentes reutilizables de TRACKT.",
};

const estados: TicketEstado[] = [
  "PENDIENTE",
  "ASIGNADO",
  "EN_EJECUCION",
  "EJECUTADO",
  "CERRADO",
  "CANCELADO",
];

const mecanico: UsuarioResumen = {
  email: "mcastillo@trackt.cl",
  nombre: "Marco Castillo",
};

const ticket: TicketResumen = {
  codigo: "ITCM-24001",
  equipo: "Camion CAT 793F - CMT-014",
  estado: "ASIGNADO",
  mecanico,
  titulo: "Fuga hidraulica en linea de levante",
};

const ot: OtResumen = {
  codigo: "OT-10482",
  descripcion:
    "Inspeccion, cambio de manguera hidraulica y prueba operativa antes de liberar equipo a turno.",
  equipo: "Camion CAT 793F - CMT-014",
  estado: "EN_EJECUCION",
  ticketsCount: 3,
};

const eventos: TimelineEvento[] = [
  {
    descripcion: "Ticket recibido desde inspeccion de turno A.",
    estado: "PENDIENTE",
    fecha: "Hoy 08:10",
    id: "evt-1",
    titulo: "Ticket creado",
    usuario: { email: "operaciones@trackt.cl", nombre: "Operaciones" },
  },
  {
    descripcion: "Se asigna mecanico lider para diagnostico en terreno.",
    estado: "ASIGNADO",
    fecha: "Hoy 08:24",
    id: "evt-2",
    titulo: "Responsable asignado",
    usuario: mecanico,
  },
  {
    descripcion: "OT abierta con repuesto reservado en bodega central.",
    estado: "EN_EJECUCION",
    fecha: "Hoy 09:05",
    id: "evt-3",
    titulo: "OT en ejecucion",
    usuario: mecanico,
  },
];

export default function DevComponentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
          Dev interno
        </p>
        <h1 className="font-semibold text-2xl tracking-tight">
          Componentes core
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Tokens de estado y componentes reutilizables para tickets y ordenes de
          trabajo.
        </p>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">StatusBadge</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {estados.map((estado) => (
            <StatusBadge estado={estado} key={estado} />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TicketCard ticket={ticket} />
        <OtCard ot={ot} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-base">UserAvatar</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <UserAvatar user={mecanico} />
            <UserAvatar user={{ email: "sin.nombre@trackt.cl" }} />
            <UserAvatar user={null} />
          </CardContent>
        </Card>

        <EmptyState
          icon="ticket"
          message="No hay tickets para los filtros aplicados. Ajusta la busqueda o crea un nuevo ticket ITCM."
          title="Sin tickets encontrados"
        />
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">TimelineItem</CardTitle>
        </CardHeader>
        <CardContent>
          {eventos.map((evento) => (
            <TimelineItem evento={evento} key={evento.id} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
