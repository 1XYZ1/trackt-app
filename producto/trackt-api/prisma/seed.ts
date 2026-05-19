/**
 * TRA-16 / TRA-17 — Seed demo multi-tenant
 *
 * Pobla la DB con data realista para QA y demos en vivo. 3 tenants:
 * - demo:         minera (default)
 * - forestal:     industria forestal
 * - construccion: maquinaria de construccion
 *
 * Requiere variables de entorno:
 *   - DATABASE_URL / DIRECT_URL (Prisma)
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Re-ejecutable: usa UUIDs deterministicos + upserts.
 */
import { PrismaClient, Prioridad } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

type UserRole = 'admin' | 'mechanic';

interface SeedUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
}

interface SeedEquipo {
  id: string;
  codigo: string;
  nombre: string;
  marca: string;
  modelo: string;
  ubicacion: string;
}

type OtEstado = 'PENDIENTE' | 'EN_PROCESO' | 'CERRADA' | 'CANCELADA';
type TicketEstado =
  | 'PENDIENTE'
  | 'ASIGNADO'
  | 'EN_EJECUCION'
  | 'EJECUTADO'
  | 'CERRADO'
  | 'CANCELADO';

interface SeedOrden {
  id: string;
  codigo: string;
  equipoId: string;
  descripcion: string;
  prioridad: Prioridad;
  estado: OtEstado;
  fechaCierre: Date | null;
}

interface SeedTicket {
  id: string;
  codigo: string;
  otId: string;
  titulo: string;
  descripcion: string;
  estado: TicketEstado;
  prioridad: Prioridad;
  mecanicoId: string | null;
  jefeId: string | null;
  fechaAsignacion: Date | null;
  fechaInicioEjecucion: Date | null;
  fechaFinEjecucion: Date | null;
  fechaValidacion: Date | null;
  fechaCierre: Date | null;
}

interface SeedEvento {
  ticketId: string;
  estadoAnterior:
    | 'PENDIENTE'
    | 'ASIGNADO'
    | 'EN_EJECUCION'
    | 'EJECUTADO'
    | null;
  estadoNuevo: 'ASIGNADO' | 'EN_EJECUCION' | 'EJECUTADO' | 'CERRADO';
  usuarioId: string;
  observacion?: string;
  createdAt: Date;
}

interface SeedTenant {
  id: string;
  nombre: string;
  users: SeedUser[];
  equipos: SeedEquipo[];
  ordenes: SeedOrden[];
  tickets: SeedTicket[];
  eventos: SeedEvento[];
}

const PASSWORD = 'Trackt!2026';

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

// ============================================================
// TENANT 1 — demo (mineria, contenido original)
// ============================================================
const demoUsers: SeedUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@trackt.demo',
    role: 'admin',
    fullName: 'Andrés Admin',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'mecanico1@trackt.demo',
    role: 'mechanic',
    fullName: 'Pablo Pérez',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'mecanico2@trackt.demo',
    role: 'mechanic',
    fullName: 'Marta Muñoz',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'mecanico3@trackt.demo',
    role: 'mechanic',
    fullName: 'Diego Díaz',
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'mecanico4@trackt.demo',
    role: 'mechanic',
    fullName: 'Sofía Soto',
  },
];

const [DEMO_ADMIN, DEMO_MEC1, DEMO_MEC2, DEMO_MEC3, DEMO_MEC4] = demoUsers;

const demoTenant: SeedTenant = {
  id: 'demo',
  nombre: 'Trackt Demo',
  users: demoUsers,
  equipos: [
    {
      id: 'eq-demo-001',
      codigo: 'EQ-001',
      nombre: 'Camión Minero CA-22',
      marca: 'Caterpillar',
      modelo: '793F',
      ubicacion: 'Rajo principal',
    },
    {
      id: 'eq-demo-002',
      codigo: 'EQ-002',
      nombre: 'Cargador Frontal CL-08',
      marca: 'Komatsu',
      modelo: 'WA900',
      ubicacion: 'Acopio sur',
    },
    {
      id: 'eq-demo-003',
      codigo: 'EQ-003',
      nombre: 'LHD Subterránea LH-03',
      marca: 'Sandvik',
      modelo: 'LH517',
      ubicacion: 'Mina subterránea nivel 4',
    },
  ],
  ordenes: [
    {
      id: 'ot-demo-1001',
      codigo: 'OT-1001',
      equipoId: 'eq-demo-001',
      descripcion: 'Mantenimiento preventivo 500h camión CA-22',
      prioridad: Prioridad.ALTA,
      estado: 'EN_PROCESO',
      fechaCierre: null,
    },
    {
      id: 'ot-demo-1002',
      codigo: 'OT-1002',
      equipoId: 'eq-demo-001',
      descripcion: 'Inspección visual de neumáticos y suspensión',
      prioridad: Prioridad.MEDIA,
      estado: 'PENDIENTE',
      fechaCierre: null,
    },
    {
      id: 'ot-demo-1003',
      codigo: 'OT-1003',
      equipoId: 'eq-demo-002',
      descripcion: 'Cambio de filtros hidráulicos cargador CL-08',
      prioridad: Prioridad.ALTA,
      estado: 'EN_PROCESO',
      fechaCierre: null,
    },
    {
      id: 'ot-demo-1004',
      codigo: 'OT-1004',
      equipoId: 'eq-demo-002',
      descripcion: 'Lubricación general y revisión de fugas',
      prioridad: Prioridad.BAJA,
      estado: 'PENDIENTE',
      fechaCierre: null,
    },
    {
      id: 'ot-demo-1005',
      codigo: 'OT-1005',
      equipoId: 'eq-demo-003',
      descripcion: 'Overhaul LHD subterránea LH-03 ciclo completo',
      prioridad: Prioridad.MEDIA,
      estado: 'CERRADA',
      fechaCierre: hoursAgo(2),
    },
  ],
  tickets: [
    {
      id: 'tk-demo-2001',
      codigo: 'ITCM-2001',
      otId: 'ot-demo-1001',
      titulo: 'Revisar fuga hidráulica en línea principal',
      descripcion: 'Fuga reportada en inspección previa al turno mañana.',
      estado: 'PENDIENTE',
      prioridad: Prioridad.ALTA,
      mecanicoId: null,
      jefeId: null,
      fechaAsignacion: null,
      fechaInicioEjecucion: null,
      fechaFinEjecucion: null,
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-demo-2002',
      codigo: 'ITCM-2002',
      otId: 'ot-demo-1002',
      titulo: 'Inspeccionar neumático delantero derecho',
      descripcion: 'Desgaste irregular detectado por operador.',
      estado: 'PENDIENTE',
      prioridad: Prioridad.MEDIA,
      mecanicoId: null,
      jefeId: null,
      fechaAsignacion: null,
      fechaInicioEjecucion: null,
      fechaFinEjecucion: null,
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-demo-2003',
      codigo: 'ITCM-2003',
      otId: 'ot-demo-1001',
      titulo: 'Cambiar manguera hidráulica de pluma',
      descripcion: 'Manguera con desgaste superficial, prevenir falla.',
      estado: 'ASIGNADO',
      prioridad: Prioridad.ALTA,
      mecanicoId: DEMO_MEC1.id,
      jefeId: DEMO_ADMIN.id,
      fechaAsignacion: hoursAgo(3),
      fechaInicioEjecucion: null,
      fechaFinEjecucion: null,
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-demo-2004',
      codigo: 'ITCM-2004',
      otId: 'ot-demo-1003',
      titulo: 'Reemplazar filtro de retorno hidráulico',
      descripcion: 'Filtro próximo a vencimiento según horómetro.',
      estado: 'ASIGNADO',
      prioridad: Prioridad.MEDIA,
      mecanicoId: DEMO_MEC2.id,
      jefeId: DEMO_ADMIN.id,
      fechaAsignacion: hoursAgo(2),
      fechaInicioEjecucion: null,
      fechaFinEjecucion: null,
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-demo-2005',
      codigo: 'ITCM-2005',
      otId: 'ot-demo-1003',
      titulo: 'Cambiar filtros de succión hidráulica',
      descripcion: 'Reemplazo programado, requiere fotos antes y después.',
      estado: 'EN_EJECUCION',
      prioridad: Prioridad.ALTA,
      mecanicoId: DEMO_MEC3.id,
      jefeId: DEMO_ADMIN.id,
      fechaAsignacion: hoursAgo(5),
      fechaInicioEjecucion: hoursAgo(1),
      fechaFinEjecucion: null,
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-demo-2006',
      codigo: 'ITCM-2006',
      otId: 'ot-demo-1004',
      titulo: 'Lubricar puntos de engrase chasis',
      descripcion: 'Rutina semanal de lubricación.',
      estado: 'EN_EJECUCION',
      prioridad: Prioridad.BAJA,
      mecanicoId: DEMO_MEC4.id,
      jefeId: DEMO_ADMIN.id,
      fechaAsignacion: hoursAgo(4),
      fechaInicioEjecucion: hoursAgo(1),
      fechaFinEjecucion: null,
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-demo-2007',
      codigo: 'ITCM-2007',
      otId: 'ot-demo-1005',
      titulo: 'Inspeccionar tren de rodaje',
      descripcion: 'Verificar desgaste de rodillos y tensores.',
      estado: 'EJECUTADO',
      prioridad: Prioridad.MEDIA,
      mecanicoId: DEMO_MEC1.id,
      jefeId: DEMO_ADMIN.id,
      fechaAsignacion: hoursAgo(24),
      fechaInicioEjecucion: hoursAgo(22),
      fechaFinEjecucion: hoursAgo(4),
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-demo-2008',
      codigo: 'ITCM-2008',
      otId: 'ot-demo-1005',
      titulo: 'Overhaul motor diésel etapa final',
      descripcion: 'Última fase del overhaul, listo para entrega.',
      estado: 'CERRADO',
      prioridad: Prioridad.ALTA,
      mecanicoId: DEMO_MEC2.id,
      jefeId: DEMO_ADMIN.id,
      fechaAsignacion: hoursAgo(72),
      fechaInicioEjecucion: hoursAgo(70),
      fechaFinEjecucion: hoursAgo(10),
      fechaValidacion: hoursAgo(5),
      fechaCierre: hoursAgo(2),
    },
  ],
  eventos: [
    { ticketId: 'tk-demo-2003', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: DEMO_ADMIN.id, createdAt: hoursAgo(3) },
    { ticketId: 'tk-demo-2004', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: DEMO_ADMIN.id, createdAt: hoursAgo(2) },
    { ticketId: 'tk-demo-2005', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: DEMO_ADMIN.id, createdAt: hoursAgo(5) },
    { ticketId: 'tk-demo-2005', estadoAnterior: 'ASIGNADO', estadoNuevo: 'EN_EJECUCION', usuarioId: DEMO_MEC3.id, createdAt: hoursAgo(1) },
    { ticketId: 'tk-demo-2006', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: DEMO_ADMIN.id, createdAt: hoursAgo(4) },
    { ticketId: 'tk-demo-2006', estadoAnterior: 'ASIGNADO', estadoNuevo: 'EN_EJECUCION', usuarioId: DEMO_MEC4.id, createdAt: hoursAgo(1) },
    { ticketId: 'tk-demo-2007', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: DEMO_ADMIN.id, createdAt: hoursAgo(24) },
    { ticketId: 'tk-demo-2007', estadoAnterior: 'ASIGNADO', estadoNuevo: 'EN_EJECUCION', usuarioId: DEMO_MEC1.id, createdAt: hoursAgo(22) },
    { ticketId: 'tk-demo-2007', estadoAnterior: 'EN_EJECUCION', estadoNuevo: 'EJECUTADO', usuarioId: DEMO_MEC1.id, observacion: 'Inspección completada, sin observaciones.', createdAt: hoursAgo(4) },
    { ticketId: 'tk-demo-2008', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: DEMO_ADMIN.id, createdAt: hoursAgo(72) },
    { ticketId: 'tk-demo-2008', estadoAnterior: 'ASIGNADO', estadoNuevo: 'EN_EJECUCION', usuarioId: DEMO_MEC2.id, createdAt: hoursAgo(70) },
    { ticketId: 'tk-demo-2008', estadoAnterior: 'EN_EJECUCION', estadoNuevo: 'EJECUTADO', usuarioId: DEMO_MEC2.id, observacion: 'Overhaul terminado, listo para validación.', createdAt: hoursAgo(10) },
    { ticketId: 'tk-demo-2008', estadoAnterior: 'EJECUTADO', estadoNuevo: 'CERRADO', usuarioId: DEMO_ADMIN.id, observacion: 'Validado y entregado a operación.', createdAt: hoursAgo(2) },
  ],
};

// ============================================================
// TENANT 2 — forestal (industria forestal)
// ============================================================
const forestalUsers: SeedUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000006',
    email: 'admin@forestal.demo',
    role: 'admin',
    fullName: 'Camila Contreras',
  },
  {
    id: '00000000-0000-0000-0000-000000000007',
    email: 'mecanico1@forestal.demo',
    role: 'mechanic',
    fullName: 'Felipe Fuentes',
  },
  {
    id: '00000000-0000-0000-0000-000000000008',
    email: 'mecanico2@forestal.demo',
    role: 'mechanic',
    fullName: 'Rocío Rojas',
  },
  {
    id: '00000000-0000-0000-0000-000000000009',
    email: 'mecanico3@forestal.demo',
    role: 'mechanic',
    fullName: 'Tomás Tapia',
  },
];

const [FOR_ADMIN, FOR_MEC1, FOR_MEC2, FOR_MEC3] = forestalUsers;

const forestalTenant: SeedTenant = {
  id: 'forestal',
  nombre: 'Forestal Andina',
  users: forestalUsers,
  equipos: [
    {
      id: 'eq-forestal-001',
      codigo: 'EQ-F01',
      nombre: 'Harvester HV-12',
      marca: 'John Deere',
      modelo: '1270G',
      ubicacion: 'Predio Curanilahue',
    },
    {
      id: 'eq-forestal-002',
      codigo: 'EQ-F02',
      nombre: 'Skidder SK-04',
      marca: 'Tigercat',
      modelo: '630E',
      ubicacion: 'Predio Mulchén',
    },
    {
      id: 'eq-forestal-003',
      codigo: 'EQ-F03',
      nombre: 'Forwarder FW-09',
      marca: 'Ponsse',
      modelo: 'Elephant King',
      ubicacion: 'Cancha de acopio Los Ángeles',
    },
  ],
  ordenes: [
    {
      id: 'ot-forestal-3001',
      codigo: 'OT-3001',
      equipoId: 'eq-forestal-001',
      descripcion: 'Mantenimiento 250h cabezal harvester HV-12',
      prioridad: Prioridad.ALTA,
      estado: 'EN_PROCESO',
      fechaCierre: null,
    },
    {
      id: 'ot-forestal-3002',
      codigo: 'OT-3002',
      equipoId: 'eq-forestal-002',
      descripcion: 'Revisión transmisión skidder SK-04',
      prioridad: Prioridad.MEDIA,
      estado: 'PENDIENTE',
      fechaCierre: null,
    },
    {
      id: 'ot-forestal-3003',
      codigo: 'OT-3003',
      equipoId: 'eq-forestal-003',
      descripcion: 'Cambio aceite hidráulico y filtros forwarder FW-09',
      prioridad: Prioridad.MEDIA,
      estado: 'EN_PROCESO',
      fechaCierre: null,
    },
    {
      id: 'ot-forestal-3004',
      codigo: 'OT-3004',
      equipoId: 'eq-forestal-001',
      descripcion: 'Afilado y cambio de sierra cabezal',
      prioridad: Prioridad.BAJA,
      estado: 'CERRADA',
      fechaCierre: hoursAgo(6),
    },
  ],
  tickets: [
    {
      id: 'tk-forestal-4001',
      codigo: 'ITCM-3001',
      otId: 'ot-forestal-3001',
      titulo: 'Verificar sensor de presión cabezal',
      descripcion: 'Lectura intermitente reportada por operador.',
      estado: 'PENDIENTE',
      prioridad: Prioridad.ALTA,
      mecanicoId: null,
      jefeId: null,
      fechaAsignacion: null,
      fechaInicioEjecucion: null,
      fechaFinEjecucion: null,
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-forestal-4002',
      codigo: 'ITCM-3002',
      otId: 'ot-forestal-3001',
      titulo: 'Reemplazar mangueras hidráulicas pluma harvester',
      descripcion: 'Desgaste superficial en mangueras principales.',
      estado: 'ASIGNADO',
      prioridad: Prioridad.ALTA,
      mecanicoId: FOR_MEC1.id,
      jefeId: FOR_ADMIN.id,
      fechaAsignacion: hoursAgo(2),
      fechaInicioEjecucion: null,
      fechaFinEjecucion: null,
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-forestal-4003',
      codigo: 'ITCM-3003',
      otId: 'ot-forestal-3002',
      titulo: 'Diagnosticar ruido caja transmisión skidder',
      descripcion: 'Ruido anormal al cambiar de marcha bajo carga.',
      estado: 'PENDIENTE',
      prioridad: Prioridad.MEDIA,
      mecanicoId: null,
      jefeId: null,
      fechaAsignacion: null,
      fechaInicioEjecucion: null,
      fechaFinEjecucion: null,
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-forestal-4004',
      codigo: 'ITCM-3004',
      otId: 'ot-forestal-3003',
      titulo: 'Cambio filtros hidráulicos forwarder FW-09',
      descripcion: 'Sustitución programada según horómetro.',
      estado: 'EN_EJECUCION',
      prioridad: Prioridad.MEDIA,
      mecanicoId: FOR_MEC2.id,
      jefeId: FOR_ADMIN.id,
      fechaAsignacion: hoursAgo(6),
      fechaInicioEjecucion: hoursAgo(2),
      fechaFinEjecucion: null,
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-forestal-4005',
      codigo: 'ITCM-3005',
      otId: 'ot-forestal-3004',
      titulo: 'Afilado cadena sierra cabezal',
      descripcion: 'Mantenimiento rutinario semanal.',
      estado: 'EJECUTADO',
      prioridad: Prioridad.BAJA,
      mecanicoId: FOR_MEC3.id,
      jefeId: FOR_ADMIN.id,
      fechaAsignacion: hoursAgo(20),
      fechaInicioEjecucion: hoursAgo(18),
      fechaFinEjecucion: hoursAgo(8),
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-forestal-4006',
      codigo: 'ITCM-3006',
      otId: 'ot-forestal-3004',
      titulo: 'Cambio espada sierra cabezal',
      descripcion: 'Reemplazo de espada por desgaste extremo.',
      estado: 'CERRADO',
      prioridad: Prioridad.MEDIA,
      mecanicoId: FOR_MEC1.id,
      jefeId: FOR_ADMIN.id,
      fechaAsignacion: hoursAgo(48),
      fechaInicioEjecucion: hoursAgo(46),
      fechaFinEjecucion: hoursAgo(20),
      fechaValidacion: hoursAgo(10),
      fechaCierre: hoursAgo(6),
    },
  ],
  eventos: [
    { ticketId: 'tk-forestal-4002', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: FOR_ADMIN.id, createdAt: hoursAgo(2) },
    { ticketId: 'tk-forestal-4004', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: FOR_ADMIN.id, createdAt: hoursAgo(6) },
    { ticketId: 'tk-forestal-4004', estadoAnterior: 'ASIGNADO', estadoNuevo: 'EN_EJECUCION', usuarioId: FOR_MEC2.id, createdAt: hoursAgo(2) },
    { ticketId: 'tk-forestal-4005', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: FOR_ADMIN.id, createdAt: hoursAgo(20) },
    { ticketId: 'tk-forestal-4005', estadoAnterior: 'ASIGNADO', estadoNuevo: 'EN_EJECUCION', usuarioId: FOR_MEC3.id, createdAt: hoursAgo(18) },
    { ticketId: 'tk-forestal-4005', estadoAnterior: 'EN_EJECUCION', estadoNuevo: 'EJECUTADO', usuarioId: FOR_MEC3.id, observacion: 'Afilado terminado, cadena lista.', createdAt: hoursAgo(8) },
    { ticketId: 'tk-forestal-4006', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: FOR_ADMIN.id, createdAt: hoursAgo(48) },
    { ticketId: 'tk-forestal-4006', estadoAnterior: 'ASIGNADO', estadoNuevo: 'EN_EJECUCION', usuarioId: FOR_MEC1.id, createdAt: hoursAgo(46) },
    { ticketId: 'tk-forestal-4006', estadoAnterior: 'EN_EJECUCION', estadoNuevo: 'EJECUTADO', usuarioId: FOR_MEC1.id, observacion: 'Espada cambiada, sierra operativa.', createdAt: hoursAgo(20) },
    { ticketId: 'tk-forestal-4006', estadoAnterior: 'EJECUTADO', estadoNuevo: 'CERRADO', usuarioId: FOR_ADMIN.id, observacion: 'Validado, equipo devuelto a operación.', createdAt: hoursAgo(6) },
  ],
};

// ============================================================
// TENANT 3 — construccion
// ============================================================
const construccionUsers: SeedUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000010',
    email: 'admin@constructora.demo',
    role: 'admin',
    fullName: 'Beatriz Bravo',
  },
  {
    id: '00000000-0000-0000-0000-000000000011',
    email: 'mecanico1@constructora.demo',
    role: 'mechanic',
    fullName: 'Ignacio Ibáñez',
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    email: 'mecanico2@constructora.demo',
    role: 'mechanic',
    fullName: 'Javiera Jara',
  },
  {
    id: '00000000-0000-0000-0000-000000000013',
    email: 'mecanico3@constructora.demo',
    role: 'mechanic',
    fullName: 'Cristóbal Castro',
  },
];

const [CON_ADMIN, CON_MEC1, CON_MEC2, CON_MEC3] = construccionUsers;

const construccionTenant: SeedTenant = {
  id: 'construccion',
  nombre: 'Constructora Sur',
  users: construccionUsers,
  equipos: [
    {
      id: 'eq-construccion-001',
      codigo: 'EQ-C01',
      nombre: 'Excavadora EX-15',
      marca: 'Volvo',
      modelo: 'EC480E',
      ubicacion: 'Obra Puente Bío Bío',
    },
    {
      id: 'eq-construccion-002',
      codigo: 'EQ-C02',
      nombre: 'Retroexcavadora RT-07',
      marca: 'JCB',
      modelo: '3CX',
      ubicacion: 'Obra Edificio Concepción',
    },
    {
      id: 'eq-construccion-003',
      codigo: 'EQ-C03',
      nombre: 'Rodillo Compactador RC-05',
      marca: 'BOMAG',
      modelo: 'BW213',
      ubicacion: 'Obra Camino Talcahuano',
    },
  ],
  ordenes: [
    {
      id: 'ot-construccion-5001',
      codigo: 'OT-5001',
      equipoId: 'eq-construccion-001',
      descripcion: 'Revisión sistema hidráulico excavadora EX-15',
      prioridad: Prioridad.ALTA,
      estado: 'EN_PROCESO',
      fechaCierre: null,
    },
    {
      id: 'ot-construccion-5002',
      codigo: 'OT-5002',
      equipoId: 'eq-construccion-002',
      descripcion: 'Cambio aceite motor retroexcavadora RT-07',
      prioridad: Prioridad.MEDIA,
      estado: 'PENDIENTE',
      fechaCierre: null,
    },
    {
      id: 'ot-construccion-5003',
      codigo: 'OT-5003',
      equipoId: 'eq-construccion-003',
      descripcion: 'Inspección vibradores rodillo RC-05',
      prioridad: Prioridad.MEDIA,
      estado: 'EN_PROCESO',
      fechaCierre: null,
    },
    {
      id: 'ot-construccion-5004',
      codigo: 'OT-5004',
      equipoId: 'eq-construccion-001',
      descripcion: 'Cambio dientes balde excavadora EX-15',
      prioridad: Prioridad.BAJA,
      estado: 'CERRADA',
      fechaCierre: hoursAgo(8),
    },
  ],
  tickets: [
    {
      id: 'tk-construccion-6001',
      codigo: 'ITCM-5001',
      otId: 'ot-construccion-5001',
      titulo: 'Diagnosticar caída de presión hidráulica',
      descripcion: 'Pérdida de fuerza al elevar pluma con carga.',
      estado: 'PENDIENTE',
      prioridad: Prioridad.ALTA,
      mecanicoId: null,
      jefeId: null,
      fechaAsignacion: null,
      fechaInicioEjecucion: null,
      fechaFinEjecucion: null,
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-construccion-6002',
      codigo: 'ITCM-5002',
      otId: 'ot-construccion-5001',
      titulo: 'Cambiar sello cilindro pluma',
      descripcion: 'Fuga visible en sello superior.',
      estado: 'ASIGNADO',
      prioridad: Prioridad.ALTA,
      mecanicoId: CON_MEC1.id,
      jefeId: CON_ADMIN.id,
      fechaAsignacion: hoursAgo(3),
      fechaInicioEjecucion: null,
      fechaFinEjecucion: null,
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-construccion-6003',
      codigo: 'ITCM-5003',
      otId: 'ot-construccion-5002',
      titulo: 'Cambio aceite y filtros motor retroexcavadora',
      descripcion: 'Mantenimiento programado por horómetro.',
      estado: 'PENDIENTE',
      prioridad: Prioridad.MEDIA,
      mecanicoId: null,
      jefeId: null,
      fechaAsignacion: null,
      fechaInicioEjecucion: null,
      fechaFinEjecucion: null,
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-construccion-6004',
      codigo: 'ITCM-5004',
      otId: 'ot-construccion-5003',
      titulo: 'Revisar amortiguadores vibrador rodillo',
      descripcion: 'Verificar estado y reemplazar si corresponde.',
      estado: 'EN_EJECUCION',
      prioridad: Prioridad.MEDIA,
      mecanicoId: CON_MEC2.id,
      jefeId: CON_ADMIN.id,
      fechaAsignacion: hoursAgo(5),
      fechaInicioEjecucion: hoursAgo(2),
      fechaFinEjecucion: null,
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-construccion-6005',
      codigo: 'ITCM-5005',
      otId: 'ot-construccion-5004',
      titulo: 'Soldadura refuerzo balde excavadora',
      descripcion: 'Reforzar zona de fijación de dientes.',
      estado: 'EJECUTADO',
      prioridad: Prioridad.BAJA,
      mecanicoId: CON_MEC3.id,
      jefeId: CON_ADMIN.id,
      fechaAsignacion: hoursAgo(28),
      fechaInicioEjecucion: hoursAgo(26),
      fechaFinEjecucion: hoursAgo(12),
      fechaValidacion: null,
      fechaCierre: null,
    },
    {
      id: 'tk-construccion-6006',
      codigo: 'ITCM-5006',
      otId: 'ot-construccion-5004',
      titulo: 'Cambio dientes balde',
      descripcion: 'Reemplazo de 5 dientes desgastados.',
      estado: 'CERRADO',
      prioridad: Prioridad.MEDIA,
      mecanicoId: CON_MEC1.id,
      jefeId: CON_ADMIN.id,
      fechaAsignacion: hoursAgo(50),
      fechaInicioEjecucion: hoursAgo(48),
      fechaFinEjecucion: hoursAgo(24),
      fechaValidacion: hoursAgo(12),
      fechaCierre: hoursAgo(8),
    },
  ],
  eventos: [
    { ticketId: 'tk-construccion-6002', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: CON_ADMIN.id, createdAt: hoursAgo(3) },
    { ticketId: 'tk-construccion-6004', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: CON_ADMIN.id, createdAt: hoursAgo(5) },
    { ticketId: 'tk-construccion-6004', estadoAnterior: 'ASIGNADO', estadoNuevo: 'EN_EJECUCION', usuarioId: CON_MEC2.id, createdAt: hoursAgo(2) },
    { ticketId: 'tk-construccion-6005', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: CON_ADMIN.id, createdAt: hoursAgo(28) },
    { ticketId: 'tk-construccion-6005', estadoAnterior: 'ASIGNADO', estadoNuevo: 'EN_EJECUCION', usuarioId: CON_MEC3.id, createdAt: hoursAgo(26) },
    { ticketId: 'tk-construccion-6005', estadoAnterior: 'EN_EJECUCION', estadoNuevo: 'EJECUTADO', usuarioId: CON_MEC3.id, observacion: 'Soldadura completada, refuerzo aplicado.', createdAt: hoursAgo(12) },
    { ticketId: 'tk-construccion-6006', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: CON_ADMIN.id, createdAt: hoursAgo(50) },
    { ticketId: 'tk-construccion-6006', estadoAnterior: 'ASIGNADO', estadoNuevo: 'EN_EJECUCION', usuarioId: CON_MEC1.id, createdAt: hoursAgo(48) },
    { ticketId: 'tk-construccion-6006', estadoAnterior: 'EN_EJECUCION', estadoNuevo: 'EJECUTADO', usuarioId: CON_MEC1.id, observacion: 'Dientes reemplazados.', createdAt: hoursAgo(24) },
    { ticketId: 'tk-construccion-6006', estadoAnterior: 'EJECUTADO', estadoNuevo: 'CERRADO', usuarioId: CON_ADMIN.id, observacion: 'Validado y devuelto a obra.', createdAt: hoursAgo(8) },
  ],
};

const TENANTS: SeedTenant[] = [demoTenant, forestalTenant, construccionTenant];

// ============================================================
// Setup
// ============================================================
function validateEnv() {
  const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  }
}

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function seedTenantRow(t: SeedTenant) {
  await prisma.tenant.upsert({
    where: { id: t.id },
    create: { id: t.id, nombre: t.nombre },
    update: { nombre: t.nombre },
  });
}

async function seedUsers(t: SeedTenant) {
  for (const u of t.users) {
    const { error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.fullName, role: u.role },
      id: u.id,
    });

    if (error && !/already/i.test(error.message)) {
      throw new Error(`createUser ${u.email}: ${error.message}`);
    }

    await prisma.$executeRaw`
      INSERT INTO public.profiles (id, full_name, role, tenant_id)
      VALUES (${u.id}::uuid, ${u.fullName}, ${u.role}::user_role, ${t.id})
      ON CONFLICT (id) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            role      = EXCLUDED.role,
            tenant_id = EXCLUDED.tenant_id,
            updated_at = NOW();
    `;
  }
}

async function seedEquipos(t: SeedTenant) {
  for (const eq of t.equipos) {
    await prisma.equipo.upsert({
      where: { tenantId_codigo: { tenantId: t.id, codigo: eq.codigo } },
      create: { ...eq, tenantId: t.id },
      update: {
        nombre: eq.nombre,
        marca: eq.marca,
        modelo: eq.modelo,
        ubicacion: eq.ubicacion,
      },
    });
  }
}

async function seedOrdenes(t: SeedTenant) {
  const admin = t.users.find((u) => u.role === 'admin');
  if (!admin) throw new Error(`Tenant ${t.id} sin admin`);

  for (const ot of t.ordenes) {
    await prisma.ordenTrabajo.upsert({
      where: { tenantId_codigo: { tenantId: t.id, codigo: ot.codigo } },
      create: {
        id: ot.id,
        tenantId: t.id,
        codigo: ot.codigo,
        equipoId: ot.equipoId,
        descripcion: ot.descripcion,
        prioridad: ot.prioridad,
        estado: ot.estado,
        creadoPorId: admin.id,
        fechaCierre: ot.fechaCierre,
      },
      update: {
        descripcion: ot.descripcion,
        prioridad: ot.prioridad,
        estado: ot.estado,
        fechaCierre: ot.fechaCierre,
      },
    });
  }
}

async function seedTickets(t: SeedTenant) {
  for (const tk of t.tickets) {
    await prisma.ticket.upsert({
      where: { tenantId_codigo: { tenantId: t.id, codigo: tk.codigo } },
      create: {
        id: tk.id,
        tenantId: t.id,
        otId: tk.otId,
        codigo: tk.codigo,
        titulo: tk.titulo,
        descripcion: tk.descripcion,
        estado: tk.estado,
        prioridad: tk.prioridad,
        mecanicoId: tk.mecanicoId,
        jefeId: tk.jefeId,
        fechaAsignacion: tk.fechaAsignacion,
        fechaInicioEjecucion: tk.fechaInicioEjecucion,
        fechaFinEjecucion: tk.fechaFinEjecucion,
        fechaValidacion: tk.fechaValidacion,
        fechaCierre: tk.fechaCierre,
      },
      update: {
        titulo: tk.titulo,
        descripcion: tk.descripcion,
        estado: tk.estado,
        prioridad: tk.prioridad,
        mecanicoId: tk.mecanicoId,
        jefeId: tk.jefeId,
        fechaAsignacion: tk.fechaAsignacion,
        fechaInicioEjecucion: tk.fechaInicioEjecucion,
        fechaFinEjecucion: tk.fechaFinEjecucion,
        fechaValidacion: tk.fechaValidacion,
        fechaCierre: tk.fechaCierre,
      },
    });
  }
}

async function seedEventos(t: SeedTenant) {
  await prisma.eventoEstadoTicket.deleteMany({
    where: { ticket: { tenantId: t.id } },
  });

  if (t.eventos.length > 0) {
    await prisma.eventoEstadoTicket.createMany({ data: t.eventos });
  }
}

async function seedSingleTenant(t: SeedTenant) {
  await seedTenantRow(t);
  await seedUsers(t);
  await seedEquipos(t);
  await seedOrdenes(t);
  await seedTickets(t);
  await seedEventos(t);
  console.log(
    `✓ ${t.id} — ${t.users.length} users, ${t.equipos.length} equipos, ${t.ordenes.length} OT, ${t.tickets.length} tickets, ${t.eventos.length} eventos`,
  );
}

async function main() {
  validateEnv();
  console.log('Iniciando seed demo multi-tenant (TRA-16)...');
  for (const t of TENANTS) {
    await seedSingleTenant(t);
  }
  const totals = TENANTS.reduce(
    (acc, t) => ({
      users: acc.users + t.users.length,
      equipos: acc.equipos + t.equipos.length,
      ordenes: acc.ordenes + t.ordenes.length,
      tickets: acc.tickets + t.tickets.length,
      eventos: acc.eventos + t.eventos.length,
    }),
    { users: 0, equipos: 0, ordenes: 0, tickets: 0, eventos: 0 },
  );
  console.log(
    `✓ Seed completado — ${TENANTS.length} tenants, ${totals.users} users, ${totals.equipos} equipos, ${totals.ordenes} OT, ${totals.tickets} tickets, ${totals.eventos} eventos`,
  );
}

main()
  .catch((e) => {
    console.error('✗ Seed falló:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
