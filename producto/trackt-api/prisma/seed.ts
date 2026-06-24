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
import {
  MarcaTipo,
  MovimientoInventarioTipo,
  PrismaClient,
  Prioridad,
  ProgramacionMantenimientoEstado,
  ReservaRepuestoEstado,
} from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

type UserRole = 'admin' | 'jefe_taller' | 'jefe_inventario' | 'mechanic';

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
  // Texto de marca; el seed lo resuelve (o crea) en el catálogo y enlaza marcaId.
  marca: string;
  modelo: string;
  ubicacion: string;
  // Tipo (texto libre legacy); el seed lo usa para enlazar tipoEquipoId al
  // catálogo TipoEquipo (matchEquipos). Opcional por compatibilidad.
  tipo?: string;
}

interface SeedMarca {
  nombre: string;
  tipo: MarcaTipo;
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

interface SeedRepuesto {
  codigo: string;
  nombre: string;
  descripcion?: string;
  categoria: string;
  unidad: string;
  stockMinimo: number;
  stockInicial: number;
  // Marca explícita (opcional); si se omite se infiere por categoría.
  marcaNombre?: string;
}

// ----- Modelos nuevos (mantenimiento industrial) -----

/** Catálogo de tipos de equipo del tenant + sus repuestos default. */
interface SeedTipoEquipo {
  id: string;
  nombre: string;
  descripcion?: string;
  // Texto(s) que matchean Equipo.tipo / Equipo.nombre para enlazar tipoEquipoId.
  // El seed asigna este tipo a los equipos cuyo `tipo` o `nombre` contenga
  // alguno de estos términos (case-insensitive).
  matchEquipos: string[];
  // Repuestos default del tipo (códigos del catálogo del tenant).
  repuestosDefault: {
    repuestoCodigo: string;
    cantidadRef: number;
    obligatorio?: boolean;
    observacion?: string;
  }[];
}

/** Plantilla de mantenimiento declarativa por tenant. */
interface SeedPlantilla {
  id: string;
  nombre: string;
  descripcion: string;
  // Se asocia a equipos de este tipo (nombre de un SeedTipoEquipo del tenant).
  tipoEquipoNombre: string;
  frecuencia: string;
  // Pasos del checklist (metadata.checklist: string[]).
  checklist: string[];
  // Insumos sugeridos (PlantillaMantenimientoItem).
  items: {
    repuestoCodigo: string;
    cantidad: number;
    obligatorio?: boolean;
    observacion?: string;
  }[];
}

/** Programación de mantenimiento declarativa por tenant. */
interface SeedProgramacion {
  id: string;
  equipoId: string;
  // Plantilla asociada (nombre de un SeedPlantilla del tenant) — opcional.
  plantillaNombre?: string;
  titulo: string;
  descripcion?: string;
  prioridad: Prioridad;
  estado: ProgramacionMantenimientoEstado;
  // Horas relativas a ahora: <0 pasado, >0 futuro.
  fechaProgramadaHoras: number;
  responsableId?: string | null;
  recurrencia?: string;
  // Si estado=GENERADA, IDs reales (OT/ticket/reserva) que el seed crea/usa.
  generacion?: { otId?: string; ticketId?: string; reservaId?: string };
}

/** Línea de una reserva sembrada. */
interface SeedReservaItem {
  repuestoCodigo: string;
  cantidad: number;
}

/** Reserva de repuestos declarativa, ligada a un ticket. */
interface SeedReserva {
  id: string;
  ticketId: string;
  estado: ReservaRepuestoEstado;
  creadoPorId: string;
  aprobadoPorId?: string | null;
  observacion?: string;
  // Horas atrás en que se creó la reserva (para createdAt de movimientos).
  horasAtras: number;
  items: SeedReservaItem[];
}

interface SeedTenant {
  id: string;
  nombre: string;
  users: SeedUser[];
  equipos: SeedEquipo[];
  ordenes: SeedOrden[];
  tickets: SeedTicket[];
  eventos: SeedEvento[];
  repuestos?: SeedRepuesto[];
  // ----- Modelos nuevos (opcionales por tenant) -----
  tiposEquipo?: SeedTipoEquipo[];
  plantillas?: SeedPlantilla[];
  programaciones?: SeedProgramacion[];
  reservas?: SeedReserva[];
}

const PASSWORD = 'Trackt!2026';

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

// ============================================================
// Generación programática de usuarios por tenant
// ------------------------------------------------------------
// Cada tenant tiene exactamente:
//   2 admin · 3 jefe_taller · 2 jefe_inventario · 15 mechanic = 22 usuarios.
//
// UUIDs deterministas y estables (idempotencia, NADA aleatorio):
//   - Usuarios "preservados" (credenciales demo que ya usa la gente)
//     conservan su UUID y email originales — ver PRESERVED_USERS.
//   - Los demás se generan con un patrón único por tenant + rol + índice:
//       00000000-0000-0000-0{T}{R}0-0000000000{NN}
//     donde T = nº de tenant (1..3), R = código de rol (1..4), NN = índice.
//     El 4º grupo es NO-nulo, por lo que jamás colisiona con los IDs
//     originales (que tienen el 4º grupo en '0000').
// ============================================================

interface TenantUserSpec {
  /** nº de tenant: 1=demo, 2=forestal, 3=construccion. */
  tenantNum: number;
  /** prefijo de email/dominio, ej. 'trackt' → '...@trackt.demo'. */
  prefix: string;
  /** apellidos para construir fullName legibles por rol/índice. */
  surnames: string[];
}

/** Reparto fijo de roles por tenant (suma = 22). */
const ROLE_PLAN: { role: UserRole; count: number; code: number }[] = [
  { role: 'admin', count: 2, code: 1 },
  { role: 'jefe_taller', count: 3, code: 2 },
  { role: 'jefe_inventario', count: 2, code: 3 },
  { role: 'mechanic', count: 15, code: 4 },
];

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  jefe_taller: 'Jefe Taller',
  jefe_inventario: 'Jefe Inventario',
  mechanic: 'Mecánico',
};

const FIRST_NAMES = [
  'Alejandro',
  'Beatriz',
  'Camilo',
  'Daniela',
  'Esteban',
  'Fernanda',
  'Gonzalo',
  'Helena',
  'Ignacio',
  'Josefa',
  'Karla',
  'Lucas',
  'Matías',
  'Natalia',
  'Óscar',
  'Paula',
  'Rodrigo',
  'Sara',
  'Tomás',
  'Úrsula',
  'Valentina',
  'Wanda',
  'Ximena',
  'Yerko',
  'Zoe',
];

/**
 * Usuarios preservados (subconjunto): mismos UUID + email + rol que ya usa
 * la gente. Las claves son `${prefix}|${role}|${seq}` (seq = índice 1-based
 * dentro del rol en ese tenant). Si una posición está aquí, se reutiliza tal
 * cual en vez de generarse.
 */
const PRESERVED_USERS: Record<
  string,
  { id: string; email: string; fullName: string }
> = {
  // Tenant demo — credenciales históricas (NO cambiar id/email).
  'trackt|admin|1': {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@trackt.demo',
    fullName: 'Andrés Admin',
  },
  'trackt|jefe_taller|1': {
    id: '00000000-0000-0000-0000-0000000000a1',
    email: 'jefe@trackt.demo',
    fullName: 'Javier Jefe',
  },
  'trackt|mechanic|1': {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'mecanico1@trackt.demo',
    fullName: 'Pablo Pérez',
  },
  'trackt|mechanic|2': {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'mecanico2@trackt.demo',
    fullName: 'Marta Muñoz',
  },
  'trackt|mechanic|3': {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'mecanico3@trackt.demo',
    fullName: 'Diego Díaz',
  },
  'trackt|mechanic|4': {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'mecanico4@trackt.demo',
    fullName: 'Sofía Soto',
  },
};

/** UUID determinista para un usuario generado (4º grupo no-nulo → sin colisión). */
function genUserId(tenantNum: number, roleCode: number, seq: number): string {
  const t = tenantNum.toString(16);
  const r = roleCode.toString(16);
  const nn = seq.toString().padStart(2, '0');
  return `00000000-0000-0000-0${t}${r}0-0000000000${nn}`;
}

/** Email para un usuario generado, ej. mecanico5@trackt.demo / inventario1@... */
function genEmail(role: UserRole, prefix: string, seq: number): string {
  const local: Record<UserRole, string> = {
    admin: 'admin',
    jefe_taller: 'jefe',
    jefe_inventario: 'inventario',
    mechanic: 'mecanico',
  };
  return `${local[role]}${seq}@${prefix}.demo`;
}

/** Genera los 22 usuarios de un tenant (preservando el subconjunto demo). */
function buildTenantUsers(spec: TenantUserSpec): SeedUser[] {
  const users: SeedUser[] = [];
  let globalIdx = 0; // para variar nombres entre usuarios del tenant

  for (const plan of ROLE_PLAN) {
    for (let seq = 1; seq <= plan.count; seq++) {
      const key = `${spec.prefix}|${plan.role}|${seq}`;
      const preserved = PRESERVED_USERS[key];

      if (preserved) {
        users.push({ ...preserved, role: plan.role });
      } else {
        const firstName = FIRST_NAMES[globalIdx % FIRST_NAMES.length];
        const surname = spec.surnames[globalIdx % spec.surnames.length];
        users.push({
          id: genUserId(spec.tenantNum, plan.code, seq),
          email: genEmail(plan.role, spec.prefix, seq),
          role: plan.role,
          fullName: `${firstName} ${surname} (${ROLE_LABEL[plan.role]})`,
        });
      }
      globalIdx++;
    }
  }

  return users;
}

/** Helpers de referencia coherente para tickets/eventos de un tenant. */
function tenantRefs(users: SeedUser[]) {
  const admins = users.filter((u) => u.role === 'admin');
  const mechanics = users.filter((u) => u.role === 'mechanic');
  if (admins.length === 0) throw new Error('Tenant sin admin');
  if (mechanics.length === 0) throw new Error('Tenant sin mecánicos');
  return {
    admin: admins[0],
    /** mecánico por round-robin (1-based) para repartir mecanicoId. */
    mech: (n: number): SeedUser => mechanics[(n - 1) % mechanics.length],
  };
}

// ============================================================
// TENANT 1 — demo (mineria, contenido original)
// ============================================================
const demoUsers: SeedUser[] = buildTenantUsers({
  tenantNum: 1,
  prefix: 'trackt',
  surnames: [
    'Pérez',
    'Muñoz',
    'Díaz',
    'Soto',
    'Rojas',
    'Vega',
    'Castro',
    'Reyes',
    'Flores',
    'Cortés',
    'Herrera',
    'Núñez',
    'Araya',
    'Fuentes',
    'Vergara',
    'Riquelme',
    'Salazar',
    'Pizarro',
    'Sandoval',
    'Maldonado',
    'Cáceres',
    'Bustos',
  ],
});

const { admin: DEMO_ADMIN, mech: demoMech } = tenantRefs(demoUsers);
const [DEMO_MEC1, DEMO_MEC2, DEMO_MEC3, DEMO_MEC4] = [
  demoMech(1),
  demoMech(2),
  demoMech(3),
  demoMech(4),
];

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
      tipo: 'Camión Minero',
    },
    {
      id: 'eq-demo-002',
      codigo: 'EQ-002',
      nombre: 'Cargador Frontal CL-08',
      marca: 'Komatsu',
      modelo: 'WA900',
      ubicacion: 'Acopio sur',
      tipo: 'Cargador Frontal',
    },
    {
      id: 'eq-demo-003',
      codigo: 'EQ-003',
      nombre: 'LHD Subterránea LH-03',
      marca: 'Sandvik',
      modelo: 'LH517',
      ubicacion: 'Mina subterránea nivel 4',
      tipo: 'LHD',
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
    {
      ticketId: 'tk-demo-2003',
      estadoAnterior: 'PENDIENTE',
      estadoNuevo: 'ASIGNADO',
      usuarioId: DEMO_ADMIN.id,
      createdAt: hoursAgo(3),
    },
    {
      ticketId: 'tk-demo-2004',
      estadoAnterior: 'PENDIENTE',
      estadoNuevo: 'ASIGNADO',
      usuarioId: DEMO_ADMIN.id,
      createdAt: hoursAgo(2),
    },
    {
      ticketId: 'tk-demo-2005',
      estadoAnterior: 'PENDIENTE',
      estadoNuevo: 'ASIGNADO',
      usuarioId: DEMO_ADMIN.id,
      createdAt: hoursAgo(5),
    },
    {
      ticketId: 'tk-demo-2005',
      estadoAnterior: 'ASIGNADO',
      estadoNuevo: 'EN_EJECUCION',
      usuarioId: DEMO_MEC3.id,
      createdAt: hoursAgo(1),
    },
    {
      ticketId: 'tk-demo-2006',
      estadoAnterior: 'PENDIENTE',
      estadoNuevo: 'ASIGNADO',
      usuarioId: DEMO_ADMIN.id,
      createdAt: hoursAgo(4),
    },
    {
      ticketId: 'tk-demo-2006',
      estadoAnterior: 'ASIGNADO',
      estadoNuevo: 'EN_EJECUCION',
      usuarioId: DEMO_MEC4.id,
      createdAt: hoursAgo(1),
    },
    {
      ticketId: 'tk-demo-2007',
      estadoAnterior: 'PENDIENTE',
      estadoNuevo: 'ASIGNADO',
      usuarioId: DEMO_ADMIN.id,
      createdAt: hoursAgo(24),
    },
    {
      ticketId: 'tk-demo-2007',
      estadoAnterior: 'ASIGNADO',
      estadoNuevo: 'EN_EJECUCION',
      usuarioId: DEMO_MEC1.id,
      createdAt: hoursAgo(22),
    },
    {
      ticketId: 'tk-demo-2007',
      estadoAnterior: 'EN_EJECUCION',
      estadoNuevo: 'EJECUTADO',
      usuarioId: DEMO_MEC1.id,
      observacion: 'Inspección completada, sin observaciones.',
      createdAt: hoursAgo(4),
    },
    {
      ticketId: 'tk-demo-2008',
      estadoAnterior: 'PENDIENTE',
      estadoNuevo: 'ASIGNADO',
      usuarioId: DEMO_ADMIN.id,
      createdAt: hoursAgo(72),
    },
    {
      ticketId: 'tk-demo-2008',
      estadoAnterior: 'ASIGNADO',
      estadoNuevo: 'EN_EJECUCION',
      usuarioId: DEMO_MEC2.id,
      createdAt: hoursAgo(70),
    },
    {
      ticketId: 'tk-demo-2008',
      estadoAnterior: 'EN_EJECUCION',
      estadoNuevo: 'EJECUTADO',
      usuarioId: DEMO_MEC2.id,
      observacion: 'Overhaul terminado, listo para validación.',
      createdAt: hoursAgo(10),
    },
    {
      ticketId: 'tk-demo-2008',
      estadoAnterior: 'EJECUTADO',
      estadoNuevo: 'CERRADO',
      usuarioId: DEMO_ADMIN.id,
      observacion: 'Validado y entregado a operación.',
      createdAt: hoursAgo(2),
    },
  ],
  repuestos: [
    {
      codigo: 'REP-DEMO-001',
      nombre: 'Filtro de aceite motor 793F',
      categoria: 'Filtros',
      unidad: 'unidad',
      stockMinimo: 5,
      stockInicial: 30,
    },
    {
      codigo: 'REP-DEMO-002',
      nombre: 'Aceite hidráulico ISO 68',
      descripcion: 'Bidón 20L',
      categoria: 'Aceites',
      unidad: 'bidon',
      stockMinimo: 4,
      stockInicial: 12,
    },
    {
      codigo: 'REP-DEMO-003',
      nombre: 'Pastilla de freno camión minero',
      categoria: 'Frenos',
      unidad: 'unidad',
      stockMinimo: 8,
      stockInicial: 6,
    },
    {
      codigo: 'REP-DEMO-004',
      nombre: 'Sensor de temperatura motor',
      categoria: 'Eléctricos',
      unidad: 'unidad',
      stockMinimo: 3,
      stockInicial: 10,
    },
    {
      codigo: 'REP-DEMO-005',
      nombre: 'Manguera hidráulica 1in x 2m',
      categoria: 'Hidráulica',
      unidad: 'metro',
      stockMinimo: 10,
      stockInicial: 40,
    },
    {
      codigo: 'REP-DEMO-006',
      nombre: 'Neumático 40.00R57',
      categoria: 'Neumáticos',
      unidad: 'unidad',
      stockMinimo: 2,
      stockInicial: 4,
    },
  ],
  tiposEquipo: [
    {
      id: 'te-demo-camion',
      nombre: 'Camión Minero',
      descripcion: 'Camión de extracción para rajo abierto.',
      matchEquipos: ['Camión Minero', 'Camión'],
      repuestosDefault: [
        { repuestoCodigo: 'REP-DEMO-001', cantidadRef: 2, obligatorio: true },
        {
          repuestoCodigo: 'REP-DEMO-002',
          cantidadRef: 3,
          obligatorio: true,
          observacion: 'Carga sistema hidráulico de levante.',
        },
        { repuestoCodigo: 'REP-DEMO-003', cantidadRef: 4, obligatorio: true },
      ],
    },
    {
      id: 'te-demo-cargador',
      nombre: 'Cargador Frontal',
      descripcion: 'Cargador frontal de gran tonelaje.',
      matchEquipos: ['Cargador Frontal', 'Cargador'],
      repuestosDefault: [
        { repuestoCodigo: 'REP-DEMO-001', cantidadRef: 2, obligatorio: true },
        { repuestoCodigo: 'REP-DEMO-005', cantidadRef: 4, obligatorio: true },
        {
          repuestoCodigo: 'REP-DEMO-002',
          cantidadRef: 2,
          obligatorio: false,
          observacion: 'Según nivel del estanque hidráulico.',
        },
      ],
    },
    {
      id: 'te-demo-lhd',
      nombre: 'LHD',
      descripcion: 'Equipo LHD (Load-Haul-Dump) subterráneo.',
      matchEquipos: ['LHD', 'Subterránea'],
      repuestosDefault: [
        { repuestoCodigo: 'REP-DEMO-001', cantidadRef: 1, obligatorio: true },
        { repuestoCodigo: 'REP-DEMO-004', cantidadRef: 1, obligatorio: true },
        { repuestoCodigo: 'REP-DEMO-005', cantidadRef: 2, obligatorio: false },
      ],
    },
    {
      id: 'te-demo-generador',
      nombre: 'Generador',
      descripcion: 'Grupo electrógeno diésel de respaldo.',
      matchEquipos: ['Generador', 'Grupo electrógeno'],
      repuestosDefault: [
        { repuestoCodigo: 'REP-DEMO-001', cantidadRef: 1, obligatorio: true },
        { repuestoCodigo: 'REP-DEMO-004', cantidadRef: 1, obligatorio: true },
      ],
    },
    {
      id: 'te-demo-compresor',
      nombre: 'Compresor',
      descripcion: 'Compresor de aire industrial.',
      matchEquipos: ['Compresor'],
      repuestosDefault: [
        { repuestoCodigo: 'REP-DEMO-001', cantidadRef: 1, obligatorio: true },
        { repuestoCodigo: 'REP-DEMO-002', cantidadRef: 1, obligatorio: false },
      ],
    },
  ],
  plantillas: [
    {
      id: 'pl-demo-camion-500h',
      nombre: 'Preventivo 500 h Camión Minero',
      descripcion: 'Mantención preventiva mayor de camión de extracción.',
      tipoEquipoNombre: 'Camión Minero',
      frecuencia: 'cada 500 h',
      checklist: [
        'Bloquear y señalizar el equipo (LOTO).',
        'Inspeccionar nivel y estado del aceite de motor.',
        'Reemplazar filtros de aceite y combustible.',
        'Revisar presión y desgaste de neumáticos.',
        'Verificar fugas en sistema hidráulico de levante.',
        'Inspeccionar pastillas y discos de freno.',
        'Registrar horómetro y cerrar checklist.',
      ],
      items: [
        { repuestoCodigo: 'REP-DEMO-001', cantidad: 2, obligatorio: true },
        {
          repuestoCodigo: 'REP-DEMO-002',
          cantidad: 3,
          obligatorio: true,
          observacion: 'Reponer aceite hidráulico ISO 68.',
        },
        { repuestoCodigo: 'REP-DEMO-003', cantidad: 4, obligatorio: false },
      ],
    },
    {
      id: 'pl-demo-camion-neumaticos',
      nombre: 'Inspección de neumáticos Camión Minero',
      descripcion: 'Rutina de inspección y rotación de neumáticos OTR.',
      tipoEquipoNombre: 'Camión Minero',
      frecuencia: 'mensual',
      checklist: [
        'Medir presión en frío de los seis neumáticos.',
        'Inspeccionar cortes, cristalización y desgaste irregular.',
        'Verificar torque de tuercas de aro.',
        'Rotar neumáticos según plan si corresponde.',
      ],
      items: [{ repuestoCodigo: 'REP-DEMO-006', cantidad: 1, obligatorio: false }],
    },
    {
      id: 'pl-demo-cargador-250h',
      nombre: 'Preventivo 250 h Cargador Frontal',
      descripcion: 'Mantención preventiva de cargador frontal.',
      tipoEquipoNombre: 'Cargador Frontal',
      frecuencia: 'cada 250 h',
      checklist: [
        'Bloquear y señalizar el equipo (LOTO).',
        'Cambiar filtros hidráulicos de retorno y succión.',
        'Revisar estado de mangueras hidráulicas.',
        'Lubricar pasadores y bujes del brazo.',
        'Verificar nivel de aceite hidráulico.',
        'Probar funciones de levante y volteo.',
      ],
      items: [
        { repuestoCodigo: 'REP-DEMO-001', cantidad: 2, obligatorio: true },
        { repuestoCodigo: 'REP-DEMO-005', cantidad: 4, obligatorio: true },
      ],
    },
    {
      id: 'pl-demo-lhd-overhaul',
      nombre: 'Overhaul LHD',
      descripcion: 'Ciclo completo de overhaul de equipo LHD subterráneo.',
      tipoEquipoNombre: 'LHD',
      frecuencia: 'cada 2000 h',
      checklist: [
        'Bloquear y señalizar el equipo (LOTO).',
        'Inspeccionar tren de rodaje y tensores.',
        'Reemplazar filtros de aceite de motor.',
        'Verificar sensores de temperatura y presión.',
        'Revisar sistema hidráulico y mangueras.',
        'Pruebas de funcionamiento en vacío.',
      ],
      items: [
        { repuestoCodigo: 'REP-DEMO-001', cantidad: 1, obligatorio: true },
        { repuestoCodigo: 'REP-DEMO-004', cantidad: 1, obligatorio: true },
        { repuestoCodigo: 'REP-DEMO-005', cantidad: 2, obligatorio: false },
      ],
    },
  ],
  // Reservas ligadas a tickets demo. Estados mezclados:
  //  - RESERVADA: retiene stockReservado (no descuenta stockActual).
  //  - SOLICITADA: pendiente de aprobación; NO toca stock.
  //  - CONSUMIDA: descuenta stockActual + genera MovimientoInventario CONSUMO.
  reservas: [
    {
      // Manguera para cambio de manguera hidráulica de pluma (ticket asignado).
      id: 'rsv-demo-2003',
      ticketId: 'tk-demo-2003',
      estado: ReservaRepuestoEstado.RESERVADA,
      creadoPorId: DEMO_MEC1.id,
      aprobadoPorId: DEMO_ADMIN.id,
      observacion: 'Reserva para cambio de manguera de pluma.',
      horasAtras: 3,
      items: [{ repuestoCodigo: 'REP-DEMO-005', cantidad: 2 }],
    },
    {
      // Filtro de retorno solicitado por el mecánico (aún sin aprobar).
      id: 'rsv-demo-2004',
      ticketId: 'tk-demo-2004',
      estado: ReservaRepuestoEstado.SOLICITADA,
      creadoPorId: DEMO_MEC2.id,
      observacion: 'Solicitud de filtro de retorno hidráulico.',
      horasAtras: 2,
      items: [{ repuestoCodigo: 'REP-DEMO-001', cantidad: 1 }],
    },
    {
      // Filtros de succión en ejecución: reservados.
      id: 'rsv-demo-2005',
      ticketId: 'tk-demo-2005',
      estado: ReservaRepuestoEstado.RESERVADA,
      creadoPorId: DEMO_MEC3.id,
      aprobadoPorId: DEMO_ADMIN.id,
      observacion: 'Filtros de succión reservados para la intervención.',
      horasAtras: 5,
      items: [
        { repuestoCodigo: 'REP-DEMO-001', cantidad: 2 },
        { repuestoCodigo: 'REP-DEMO-002', cantidad: 1 },
      ],
    },
    {
      // Overhaul cerrado: insumos consumidos (descuenta stock real).
      id: 'rsv-demo-2008',
      ticketId: 'tk-demo-2008',
      estado: ReservaRepuestoEstado.CONSUMIDA,
      creadoPorId: DEMO_MEC2.id,
      aprobadoPorId: DEMO_ADMIN.id,
      observacion: 'Insumos consumidos en overhaul de LHD.',
      horasAtras: 10,
      items: [
        { repuestoCodigo: 'REP-DEMO-001', cantidad: 1 },
        { repuestoCodigo: 'REP-DEMO-004', cantidad: 1 },
      ],
    },
  ],
  programaciones: [
    {
      // Futura, planificada (PROGRAMADA) sobre el camión.
      id: 'prog-demo-001',
      equipoId: 'eq-demo-001',
      plantillaNombre: 'Preventivo 500 h Camión Minero',
      titulo: 'Preventivo 500 h camión CA-22',
      descripcion: 'Programado para el próximo ciclo de horómetro.',
      prioridad: Prioridad.ALTA,
      estado: ProgramacionMantenimientoEstado.PROGRAMADA,
      fechaProgramadaHoras: 24 * 14,
      responsableId: DEMO_ADMIN.id,
      recurrencia: 'cada 500 h',
    },
    {
      // Futura, inspección mensual de neumáticos.
      id: 'prog-demo-002',
      equipoId: 'eq-demo-001',
      plantillaNombre: 'Inspección de neumáticos Camión Minero',
      titulo: 'Inspección mensual de neumáticos CA-22',
      prioridad: Prioridad.MEDIA,
      estado: ProgramacionMantenimientoEstado.PROGRAMADA,
      fechaProgramadaHoras: 24 * 30,
      responsableId: DEMO_ADMIN.id,
      recurrencia: 'mensual',
    },
    {
      // Pasada y ya GENERADA: apunta a OT/ticket/reserva reales del overhaul.
      id: 'prog-demo-003',
      equipoId: 'eq-demo-003',
      plantillaNombre: 'Overhaul LHD',
      titulo: 'Overhaul LHD LH-03',
      descripcion: 'Generó la OT-1005 y su ticket de overhaul.',
      prioridad: Prioridad.MEDIA,
      estado: ProgramacionMantenimientoEstado.GENERADA,
      fechaProgramadaHoras: -24 * 3,
      responsableId: DEMO_ADMIN.id,
      recurrencia: 'cada 2000 h',
      generacion: {
        otId: 'ot-demo-1005',
        ticketId: 'tk-demo-2008',
        reservaId: 'rsv-demo-2008',
      },
    },
  ],
};

// ============================================================
// TENANT 2 — forestal (industria forestal)
// ============================================================
const forestalUsers: SeedUser[] = buildTenantUsers({
  tenantNum: 2,
  prefix: 'forestal',
  surnames: [
    'Contreras',
    'Fuentes',
    'Rojas',
    'Tapia',
    'Lagos',
    'Espinoza',
    'Cárdenas',
    'Aguilera',
    'Henríquez',
    'Garrido',
    'Sepúlveda',
    'Carrasco',
    'Venegas',
    'Mella',
    'Quezada',
    'Ortega',
    'Briones',
    'Toro',
    'Inostroza',
    'Parra',
    'Saavedra',
    'Bravo',
  ],
});

const { admin: FOR_ADMIN, mech: forMech } = tenantRefs(forestalUsers);
const [FOR_MEC1, FOR_MEC2, FOR_MEC3] = [forMech(1), forMech(2), forMech(3)];

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
      tipo: 'Harvester',
    },
    {
      id: 'eq-forestal-002',
      codigo: 'EQ-F02',
      nombre: 'Skidder SK-04',
      marca: 'Tigercat',
      modelo: '630E',
      ubicacion: 'Predio Mulchén',
      tipo: 'Skidder',
    },
    {
      id: 'eq-forestal-003',
      codigo: 'EQ-F03',
      nombre: 'Forwarder FW-09',
      marca: 'Ponsse',
      modelo: 'Elephant King',
      ubicacion: 'Cancha de acopio Los Ángeles',
      tipo: 'Forwarder',
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
    {
      ticketId: 'tk-forestal-4002',
      estadoAnterior: 'PENDIENTE',
      estadoNuevo: 'ASIGNADO',
      usuarioId: FOR_ADMIN.id,
      createdAt: hoursAgo(2),
    },
    {
      ticketId: 'tk-forestal-4004',
      estadoAnterior: 'PENDIENTE',
      estadoNuevo: 'ASIGNADO',
      usuarioId: FOR_ADMIN.id,
      createdAt: hoursAgo(6),
    },
    {
      ticketId: 'tk-forestal-4004',
      estadoAnterior: 'ASIGNADO',
      estadoNuevo: 'EN_EJECUCION',
      usuarioId: FOR_MEC2.id,
      createdAt: hoursAgo(2),
    },
    {
      ticketId: 'tk-forestal-4005',
      estadoAnterior: 'PENDIENTE',
      estadoNuevo: 'ASIGNADO',
      usuarioId: FOR_ADMIN.id,
      createdAt: hoursAgo(20),
    },
    {
      ticketId: 'tk-forestal-4005',
      estadoAnterior: 'ASIGNADO',
      estadoNuevo: 'EN_EJECUCION',
      usuarioId: FOR_MEC3.id,
      createdAt: hoursAgo(18),
    },
    {
      ticketId: 'tk-forestal-4005',
      estadoAnterior: 'EN_EJECUCION',
      estadoNuevo: 'EJECUTADO',
      usuarioId: FOR_MEC3.id,
      observacion: 'Afilado terminado, cadena lista.',
      createdAt: hoursAgo(8),
    },
    {
      ticketId: 'tk-forestal-4006',
      estadoAnterior: 'PENDIENTE',
      estadoNuevo: 'ASIGNADO',
      usuarioId: FOR_ADMIN.id,
      createdAt: hoursAgo(48),
    },
    {
      ticketId: 'tk-forestal-4006',
      estadoAnterior: 'ASIGNADO',
      estadoNuevo: 'EN_EJECUCION',
      usuarioId: FOR_MEC1.id,
      createdAt: hoursAgo(46),
    },
    {
      ticketId: 'tk-forestal-4006',
      estadoAnterior: 'EN_EJECUCION',
      estadoNuevo: 'EJECUTADO',
      usuarioId: FOR_MEC1.id,
      observacion: 'Espada cambiada, sierra operativa.',
      createdAt: hoursAgo(20),
    },
    {
      ticketId: 'tk-forestal-4006',
      estadoAnterior: 'EJECUTADO',
      estadoNuevo: 'CERRADO',
      usuarioId: FOR_ADMIN.id,
      observacion: 'Validado, equipo devuelto a operación.',
      createdAt: hoursAgo(6),
    },
  ],
  repuestos: [
    {
      codigo: 'REP-FOR-001',
      nombre: 'Filtro de aire skidder',
      categoria: 'Filtros',
      unidad: 'unidad',
      stockMinimo: 4,
      stockInicial: 15,
    },
    {
      codigo: 'REP-FOR-002',
      nombre: 'Aceite cadena motosierra',
      descripcion: 'Bidón 5L',
      categoria: 'Aceites',
      unidad: 'bidon',
      stockMinimo: 6,
      stockInicial: 18,
    },
    {
      codigo: 'REP-FOR-003',
      nombre: 'Cable de winche forestal',
      categoria: 'Hidráulica',
      unidad: 'metro',
      stockMinimo: 20,
      stockInicial: 50,
    },
    {
      codigo: 'REP-FOR-004',
      nombre: 'Batería 12V 100Ah',
      categoria: 'Eléctricos',
      unidad: 'unidad',
      stockMinimo: 2,
      stockInicial: 1,
    },
    {
      codigo: 'REP-FOR-005',
      nombre: 'Disco de freno feller',
      categoria: 'Frenos',
      unidad: 'unidad',
      stockMinimo: 4,
      stockInicial: 8,
    },
    {
      codigo: 'REP-FOR-006',
      nombre: 'Neumático forestal 24R21',
      categoria: 'Neumáticos',
      unidad: 'unidad',
      stockMinimo: 2,
      stockInicial: 3,
    },
  ],
  tiposEquipo: [
    {
      id: 'te-for-harvester',
      nombre: 'Harvester',
      descripcion: 'Cosechadora forestal con cabezal procesador.',
      matchEquipos: ['Harvester'],
      repuestosDefault: [
        { repuestoCodigo: 'REP-FOR-001', cantidadRef: 1, obligatorio: true },
        {
          repuestoCodigo: 'REP-FOR-002',
          cantidadRef: 2,
          obligatorio: true,
          observacion: 'Lubricación de cadena del cabezal.',
        },
        { repuestoCodigo: 'REP-FOR-005', cantidadRef: 1, obligatorio: false },
      ],
    },
    {
      id: 'te-for-skidder',
      nombre: 'Skidder',
      descripcion: 'Tractor forestal de arrastre con winche.',
      matchEquipos: ['Skidder'],
      repuestosDefault: [
        { repuestoCodigo: 'REP-FOR-001', cantidadRef: 1, obligatorio: true },
        { repuestoCodigo: 'REP-FOR-003', cantidadRef: 10, obligatorio: true },
        { repuestoCodigo: 'REP-FOR-004', cantidadRef: 1, obligatorio: false },
      ],
    },
    {
      id: 'te-for-forwarder',
      nombre: 'Forwarder',
      descripcion: 'Autocargador forestal de transporte.',
      matchEquipos: ['Forwarder'],
      repuestosDefault: [
        { repuestoCodigo: 'REP-FOR-001', cantidadRef: 1, obligatorio: true },
        { repuestoCodigo: 'REP-FOR-006', cantidadRef: 1, obligatorio: false },
      ],
    },
    {
      id: 'te-for-feller',
      nombre: 'Feller Buncher',
      descripcion: 'Cosechadora de volteo y agrupado.',
      matchEquipos: ['Feller', 'Feller Buncher'],
      repuestosDefault: [
        { repuestoCodigo: 'REP-FOR-001', cantidadRef: 1, obligatorio: true },
        { repuestoCodigo: 'REP-FOR-005', cantidadRef: 2, obligatorio: true },
      ],
    },
  ],
  plantillas: [
    {
      id: 'pl-for-harvester-250h',
      nombre: 'Preventivo 250 h Harvester',
      descripcion: 'Mantención del cabezal procesador y sistema hidráulico.',
      tipoEquipoNombre: 'Harvester',
      frecuencia: 'cada 250 h',
      checklist: [
        'Bloquear y señalizar el equipo (LOTO).',
        'Inspeccionar sensores de presión del cabezal.',
        'Revisar y reponer aceite de lubricación de cadena.',
        'Verificar estado de mangueras hidráulicas de la pluma.',
        'Cambiar filtro de aire si está saturado.',
        'Afilar o cambiar cadena de sierra.',
        'Pruebas de medición y troceo.',
      ],
      items: [
        { repuestoCodigo: 'REP-FOR-001', cantidad: 1, obligatorio: true },
        {
          repuestoCodigo: 'REP-FOR-002',
          cantidad: 2,
          obligatorio: true,
          observacion: 'Reponer aceite de cadena.',
        },
      ],
    },
    {
      id: 'pl-for-skidder-transmision',
      nombre: 'Revisión transmisión Skidder',
      descripcion: 'Diagnóstico y mantención de transmisión y winche.',
      tipoEquipoNombre: 'Skidder',
      frecuencia: 'cada 500 h',
      checklist: [
        'Bloquear y señalizar el equipo (LOTO).',
        'Inspeccionar nivel y estado del aceite de transmisión.',
        'Revisar ruidos y holguras en la caja.',
        'Verificar estado del cable de winche.',
        'Comprobar carga de batería.',
        'Prueba de marcha bajo carga.',
      ],
      items: [
        { repuestoCodigo: 'REP-FOR-003', cantidad: 10, obligatorio: true },
        { repuestoCodigo: 'REP-FOR-004', cantidad: 1, obligatorio: false },
      ],
    },
    {
      id: 'pl-for-forwarder-hidraulico',
      nombre: 'Cambio hidráulico Forwarder',
      descripcion: 'Cambio de aceite hidráulico y filtros del autocargador.',
      tipoEquipoNombre: 'Forwarder',
      frecuencia: 'cada 500 h',
      checklist: [
        'Bloquear y señalizar el equipo (LOTO).',
        'Drenar y reponer aceite hidráulico.',
        'Reemplazar filtros hidráulicos.',
        'Inspeccionar grúa y pinza de carga.',
        'Verificar presión de neumáticos.',
      ],
      items: [{ repuestoCodigo: 'REP-FOR-001', cantidad: 1, obligatorio: true }],
    },
  ],
  reservas: [
    {
      // Mangueras de pluma del harvester (ticket asignado): reservadas.
      id: 'rsv-for-4002',
      ticketId: 'tk-forestal-4002',
      estado: ReservaRepuestoEstado.RESERVADA,
      creadoPorId: FOR_MEC1.id,
      aprobadoPorId: FOR_ADMIN.id,
      observacion: 'Cable y aceite reservados para intervención del cabezal.',
      horasAtras: 2,
      items: [
        { repuestoCodigo: 'REP-FOR-002', cantidad: 2 },
        { repuestoCodigo: 'REP-FOR-003', cantidad: 5 },
      ],
    },
    {
      // Filtros del forwarder en ejecución: solicitados por el mecánico.
      id: 'rsv-for-4004',
      ticketId: 'tk-forestal-4004',
      estado: ReservaRepuestoEstado.SOLICITADA,
      creadoPorId: FOR_MEC2.id,
      observacion: 'Solicitud de filtro de aire para forwarder.',
      horasAtras: 6,
      items: [{ repuestoCodigo: 'REP-FOR-001', cantidad: 1 }],
    },
    {
      // Cambio de espada cerrado: aceite de cadena consumido.
      id: 'rsv-for-4006',
      ticketId: 'tk-forestal-4006',
      estado: ReservaRepuestoEstado.CONSUMIDA,
      creadoPorId: FOR_MEC1.id,
      aprobadoPorId: FOR_ADMIN.id,
      observacion: 'Aceite de cadena consumido en cambio de espada.',
      horasAtras: 20,
      items: [{ repuestoCodigo: 'REP-FOR-002', cantidad: 3 }],
    },
  ],
  programaciones: [
    {
      id: 'prog-for-001',
      equipoId: 'eq-forestal-001',
      plantillaNombre: 'Preventivo 250 h Harvester',
      titulo: 'Preventivo 250 h Harvester HV-12',
      descripcion: 'Programado para el próximo ciclo del cabezal.',
      prioridad: Prioridad.ALTA,
      estado: ProgramacionMantenimientoEstado.PROGRAMADA,
      fechaProgramadaHoras: 24 * 10,
      responsableId: FOR_ADMIN.id,
      recurrencia: 'cada 250 h',
    },
    {
      id: 'prog-for-002',
      equipoId: 'eq-forestal-002',
      plantillaNombre: 'Revisión transmisión Skidder',
      titulo: 'Revisión transmisión Skidder SK-04',
      prioridad: Prioridad.MEDIA,
      estado: ProgramacionMantenimientoEstado.PROGRAMADA,
      fechaProgramadaHoras: 24 * 21,
      responsableId: FOR_ADMIN.id,
      recurrencia: 'cada 500 h',
    },
    {
      // GENERADA: el afilado/cambio de espada ya cerró su OT/ticket/reserva.
      id: 'prog-for-003',
      equipoId: 'eq-forestal-001',
      plantillaNombre: 'Preventivo 250 h Harvester',
      titulo: 'Afilado y cambio de sierra cabezal HV-12',
      descripcion: 'Generó la OT-3004 y su ticket de cambio de espada.',
      prioridad: Prioridad.BAJA,
      estado: ProgramacionMantenimientoEstado.GENERADA,
      fechaProgramadaHoras: -24 * 2,
      responsableId: FOR_ADMIN.id,
      recurrencia: 'mensual',
      generacion: {
        otId: 'ot-forestal-3004',
        ticketId: 'tk-forestal-4006',
        reservaId: 'rsv-for-4006',
      },
    },
  ],
};

// ============================================================
// TENANT 3 — construccion
// ============================================================
const construccionUsers: SeedUser[] = buildTenantUsers({
  tenantNum: 3,
  prefix: 'constructora',
  surnames: [
    'Bravo',
    'Ibáñez',
    'Jara',
    'Castro',
    'Morales',
    'Silva',
    'Tapia',
    'Valdés',
    'Cifuentes',
    'Donoso',
    'Escobar',
    'Gallardo',
    'Hidalgo',
    'Lobos',
    'Miranda',
    'Norambuena',
    'Olivares',
    'Peña',
    'Quiroz',
    'Retamal',
    'Sáez',
    'Urrutia',
  ],
});

const { admin: CON_ADMIN, mech: conMech } = tenantRefs(construccionUsers);
const [CON_MEC1, CON_MEC2, CON_MEC3] = [conMech(1), conMech(2), conMech(3)];

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
      tipo: 'Excavadora',
    },
    {
      id: 'eq-construccion-002',
      codigo: 'EQ-C02',
      nombre: 'Retroexcavadora RT-07',
      marca: 'JCB',
      modelo: '3CX',
      ubicacion: 'Obra Edificio Concepción',
      tipo: 'Retroexcavadora',
    },
    {
      id: 'eq-construccion-003',
      codigo: 'EQ-C03',
      nombre: 'Rodillo Compactador RC-05',
      marca: 'BOMAG',
      modelo: 'BW213',
      ubicacion: 'Obra Camino Talcahuano',
      tipo: 'Rodillo Compactador',
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
    {
      ticketId: 'tk-construccion-6002',
      estadoAnterior: 'PENDIENTE',
      estadoNuevo: 'ASIGNADO',
      usuarioId: CON_ADMIN.id,
      createdAt: hoursAgo(3),
    },
    {
      ticketId: 'tk-construccion-6004',
      estadoAnterior: 'PENDIENTE',
      estadoNuevo: 'ASIGNADO',
      usuarioId: CON_ADMIN.id,
      createdAt: hoursAgo(5),
    },
    {
      ticketId: 'tk-construccion-6004',
      estadoAnterior: 'ASIGNADO',
      estadoNuevo: 'EN_EJECUCION',
      usuarioId: CON_MEC2.id,
      createdAt: hoursAgo(2),
    },
    {
      ticketId: 'tk-construccion-6005',
      estadoAnterior: 'PENDIENTE',
      estadoNuevo: 'ASIGNADO',
      usuarioId: CON_ADMIN.id,
      createdAt: hoursAgo(28),
    },
    {
      ticketId: 'tk-construccion-6005',
      estadoAnterior: 'ASIGNADO',
      estadoNuevo: 'EN_EJECUCION',
      usuarioId: CON_MEC3.id,
      createdAt: hoursAgo(26),
    },
    {
      ticketId: 'tk-construccion-6005',
      estadoAnterior: 'EN_EJECUCION',
      estadoNuevo: 'EJECUTADO',
      usuarioId: CON_MEC3.id,
      observacion: 'Soldadura completada, refuerzo aplicado.',
      createdAt: hoursAgo(12),
    },
    {
      ticketId: 'tk-construccion-6006',
      estadoAnterior: 'PENDIENTE',
      estadoNuevo: 'ASIGNADO',
      usuarioId: CON_ADMIN.id,
      createdAt: hoursAgo(50),
    },
    {
      ticketId: 'tk-construccion-6006',
      estadoAnterior: 'ASIGNADO',
      estadoNuevo: 'EN_EJECUCION',
      usuarioId: CON_MEC1.id,
      createdAt: hoursAgo(48),
    },
    {
      ticketId: 'tk-construccion-6006',
      estadoAnterior: 'EN_EJECUCION',
      estadoNuevo: 'EJECUTADO',
      usuarioId: CON_MEC1.id,
      observacion: 'Dientes reemplazados.',
      createdAt: hoursAgo(24),
    },
    {
      ticketId: 'tk-construccion-6006',
      estadoAnterior: 'EJECUTADO',
      estadoNuevo: 'CERRADO',
      usuarioId: CON_ADMIN.id,
      observacion: 'Validado y devuelto a obra.',
      createdAt: hoursAgo(8),
    },
  ],
  repuestos: [
    {
      codigo: 'REP-CON-001',
      nombre: 'Filtro hidráulico excavadora',
      categoria: 'Filtros',
      unidad: 'unidad',
      stockMinimo: 4,
      stockInicial: 20,
    },
    {
      codigo: 'REP-CON-002',
      nombre: 'Aceite motor 15W40',
      descripcion: 'Bidón 20L',
      categoria: 'Aceites',
      unidad: 'bidon',
      stockMinimo: 5,
      stockInicial: 14,
    },
    {
      codigo: 'REP-CON-003',
      nombre: 'Diente de balde excavadora',
      categoria: 'Hidráulica',
      unidad: 'unidad',
      stockMinimo: 6,
      stockInicial: 22,
    },
    {
      codigo: 'REP-CON-004',
      nombre: 'Manguera de freno camión',
      categoria: 'Frenos',
      unidad: 'metro',
      stockMinimo: 8,
      stockInicial: 5,
    },
    {
      codigo: 'REP-CON-005',
      nombre: 'Alternador 24V',
      categoria: 'Eléctricos',
      unidad: 'unidad',
      stockMinimo: 2,
      stockInicial: 6,
    },
    {
      codigo: 'REP-CON-006',
      nombre: 'Neumático 17.5R25',
      categoria: 'Neumáticos',
      unidad: 'unidad',
      stockMinimo: 2,
      stockInicial: 4,
    },
  ],
  tiposEquipo: [
    {
      id: 'te-con-excavadora',
      nombre: 'Excavadora',
      descripcion: 'Excavadora hidráulica de orugas.',
      matchEquipos: ['Excavadora'],
      repuestosDefault: [
        { repuestoCodigo: 'REP-CON-001', cantidadRef: 2, obligatorio: true },
        {
          repuestoCodigo: 'REP-CON-003',
          cantidadRef: 5,
          obligatorio: true,
          observacion: 'Juego de dientes de balde.',
        },
        { repuestoCodigo: 'REP-CON-002', cantidadRef: 2, obligatorio: false },
      ],
    },
    {
      id: 'te-con-retro',
      nombre: 'Retroexcavadora',
      descripcion: 'Retroexcavadora mixta cargadora.',
      matchEquipos: ['Retroexcavadora', 'Retro'],
      repuestosDefault: [
        { repuestoCodigo: 'REP-CON-001', cantidadRef: 1, obligatorio: true },
        { repuestoCodigo: 'REP-CON-002', cantidadRef: 2, obligatorio: true },
        { repuestoCodigo: 'REP-CON-004', cantidadRef: 2, obligatorio: false },
      ],
    },
    {
      id: 'te-con-rodillo',
      nombre: 'Rodillo Compactador',
      descripcion: 'Rodillo vibratorio para compactación.',
      matchEquipos: ['Rodillo', 'Compactador'],
      repuestosDefault: [
        { repuestoCodigo: 'REP-CON-001', cantidadRef: 1, obligatorio: true },
        { repuestoCodigo: 'REP-CON-005', cantidadRef: 1, obligatorio: false },
      ],
    },
    {
      id: 'te-con-grua',
      nombre: 'Grúa',
      descripcion: 'Grúa hidráulica sobre camión.',
      matchEquipos: ['Grúa', 'Grua'],
      repuestosDefault: [
        { repuestoCodigo: 'REP-CON-001', cantidadRef: 1, obligatorio: true },
        { repuestoCodigo: 'REP-CON-004', cantidadRef: 2, obligatorio: true },
      ],
    },
    {
      id: 'te-con-camion',
      nombre: 'Camión Tolva',
      descripcion: 'Camión tolva para movimiento de tierra.',
      matchEquipos: ['Camión Tolva', 'Tolva'],
      repuestosDefault: [
        { repuestoCodigo: 'REP-CON-002', cantidadRef: 2, obligatorio: true },
        { repuestoCodigo: 'REP-CON-006', cantidadRef: 1, obligatorio: false },
      ],
    },
  ],
  plantillas: [
    {
      id: 'pl-con-excavadora-hidraulico',
      nombre: 'Revisión hidráulica Excavadora',
      descripcion: 'Diagnóstico y mantención del sistema hidráulico.',
      tipoEquipoNombre: 'Excavadora',
      frecuencia: 'cada 500 h',
      checklist: [
        'Bloquear y señalizar el equipo (LOTO).',
        'Medir presión del circuito hidráulico principal.',
        'Reemplazar filtros hidráulicos.',
        'Inspeccionar sellos de cilindros de pluma y balde.',
        'Revisar estado de mangueras de freno y latiguillos.',
        'Verificar desgaste de dientes de balde.',
        'Pruebas de levante y giro.',
      ],
      items: [
        { repuestoCodigo: 'REP-CON-001', cantidad: 2, obligatorio: true },
        {
          repuestoCodigo: 'REP-CON-003',
          cantidad: 5,
          obligatorio: false,
          observacion: 'Reponer dientes de balde si hay desgaste.',
        },
      ],
    },
    {
      id: 'pl-con-excavadora-balde',
      nombre: 'Mantención de balde Excavadora',
      descripcion: 'Cambio y refuerzo de dientes y adaptadores del balde.',
      tipoEquipoNombre: 'Excavadora',
      frecuencia: 'cada 1000 h',
      checklist: [
        'Bloquear y señalizar el equipo (LOTO).',
        'Inspeccionar adaptadores y pasadores.',
        'Reemplazar dientes desgastados.',
        'Verificar soldaduras de refuerzo.',
        'Comprobar fijación final.',
      ],
      items: [{ repuestoCodigo: 'REP-CON-003', cantidad: 5, obligatorio: true }],
    },
    {
      id: 'pl-con-retro-motor',
      nombre: 'Cambio de aceite Retroexcavadora',
      descripcion: 'Cambio de aceite y filtros de motor.',
      tipoEquipoNombre: 'Retroexcavadora',
      frecuencia: 'cada 250 h',
      checklist: [
        'Bloquear y señalizar el equipo (LOTO).',
        'Drenar aceite de motor en caliente.',
        'Reemplazar filtro de aceite e hidráulico.',
        'Reponer aceite de motor 15W40.',
        'Inspeccionar mangueras de freno.',
        'Verificar niveles y registrar horómetro.',
      ],
      items: [
        { repuestoCodigo: 'REP-CON-002', cantidad: 2, obligatorio: true },
        { repuestoCodigo: 'REP-CON-001', cantidad: 1, obligatorio: true },
      ],
    },
  ],
  reservas: [
    {
      // Sello de cilindro de pluma (ticket asignado): filtro reservado.
      id: 'rsv-con-6002',
      ticketId: 'tk-construccion-6002',
      estado: ReservaRepuestoEstado.RESERVADA,
      creadoPorId: CON_MEC1.id,
      aprobadoPorId: CON_ADMIN.id,
      observacion: 'Filtro hidráulico reservado para cambio de sello.',
      horasAtras: 3,
      items: [{ repuestoCodigo: 'REP-CON-001', cantidad: 1 }],
    },
    {
      // Amortiguadores del rodillo en ejecución: alternador solicitado.
      id: 'rsv-con-6004',
      ticketId: 'tk-construccion-6004',
      estado: ReservaRepuestoEstado.SOLICITADA,
      creadoPorId: CON_MEC2.id,
      observacion: 'Solicitud de filtro hidráulico para rodillo.',
      horasAtras: 5,
      items: [{ repuestoCodigo: 'REP-CON-001', cantidad: 1 }],
    },
    {
      // Cambio de dientes cerrado: dientes de balde consumidos.
      id: 'rsv-con-6006',
      ticketId: 'tk-construccion-6006',
      estado: ReservaRepuestoEstado.CONSUMIDA,
      creadoPorId: CON_MEC1.id,
      aprobadoPorId: CON_ADMIN.id,
      observacion: 'Cinco dientes de balde consumidos.',
      horasAtras: 24,
      items: [{ repuestoCodigo: 'REP-CON-003', cantidad: 5 }],
    },
  ],
  programaciones: [
    {
      id: 'prog-con-001',
      equipoId: 'eq-construccion-001',
      plantillaNombre: 'Revisión hidráulica Excavadora',
      titulo: 'Revisión hidráulica Excavadora EX-15',
      descripcion: 'Programada para el próximo ciclo de horómetro.',
      prioridad: Prioridad.ALTA,
      estado: ProgramacionMantenimientoEstado.PROGRAMADA,
      fechaProgramadaHoras: 24 * 12,
      responsableId: CON_ADMIN.id,
      recurrencia: 'cada 500 h',
    },
    {
      id: 'prog-con-002',
      equipoId: 'eq-construccion-002',
      plantillaNombre: 'Cambio de aceite Retroexcavadora',
      titulo: 'Cambio de aceite Retroexcavadora RT-07',
      prioridad: Prioridad.MEDIA,
      estado: ProgramacionMantenimientoEstado.PROGRAMADA,
      fechaProgramadaHoras: 24 * 7,
      responsableId: CON_ADMIN.id,
      recurrencia: 'cada 250 h',
    },
    {
      // GENERADA: el cambio de dientes ya cerró su OT/ticket/reserva.
      id: 'prog-con-003',
      equipoId: 'eq-construccion-001',
      plantillaNombre: 'Mantención de balde Excavadora',
      titulo: 'Cambio dientes balde EX-15',
      descripcion: 'Generó la OT-5004 y su ticket de cambio de dientes.',
      prioridad: Prioridad.BAJA,
      estado: ProgramacionMantenimientoEstado.GENERADA,
      fechaProgramadaHoras: -24 * 2,
      responsableId: CON_ADMIN.id,
      recurrencia: 'cada 1000 h',
      generacion: {
        otId: 'ot-construccion-5004',
        ticketId: 'tk-construccion-6006',
        reservaId: 'rsv-con-6006',
      },
    },
  ],
};

const TENANTS: SeedTenant[] = [demoTenant, forestalTenant, construccionTenant];

// ============================================================
// Setup
// ============================================================
function validateEnv() {
  const required = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];
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

/**
 * Build a map of email → { id, email } for ALL existing Supabase auth users,
 * paging through every page until done.
 */
async function listAllAuthUsers(): Promise<Map<string, { id: string; email: string }>> {
  const map = new Map<string, { id: string; email: string }>();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      console.warn(`  [warn] listUsers page ${page}: ${error.message}`);
      break;
    }
    if (!data || data.users.length === 0) break;

    for (const u of data.users) {
      if (u.email) {
        map.set(u.email, { id: u.id, email: u.email });
      }
    }

    // If we got fewer than perPage, we're on the last page
    if (data.users.length < perPage) break;
    page++;
  }

  return map;
}

/**
 * For every seed user, if an auth user exists with the same email but a
 * DIFFERENT id, delete its profile row first (FK: profiles.id → auth.users.id)
 * then delete the stale auth user — so we can re-create with the deterministic id.
 */
async function cleanStaleAuthUsers(tenantUsers: SeedUser[], authByEmail: Map<string, { id: string; email: string }>) {
  for (const u of tenantUsers) {
    const existing = authByEmail.get(u.email);
    if (!existing) continue;          // not in auth at all → nothing to clean
    if (existing.id === u.id) continue; // already the right id → idempotent

    console.log(`  [cleanup] ${u.email}: stale id ${existing.id} → will replace with ${u.id}`);

    // 1. Delete profile row (FK child) before deleting auth user (FK parent)
    try {
      await prisma.$executeRaw`DELETE FROM public.profiles WHERE id = ${existing.id}::uuid`;
    } catch (e: unknown) {
      console.warn(`  [warn] could not delete stale profile ${existing.id}: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 2. Delete stale auth user
    const { error } = await supabase.auth.admin.deleteUser(existing.id);
    if (error) {
      console.warn(`  [warn] could not delete stale auth user ${existing.id} (${u.email}): ${error.message}`);
      // Remove from map so we don't try INSERT to profiles for this user
      authByEmail.delete(u.email);
    } else {
      // Remove from map; it will be re-added after createUser succeeds
      authByEmail.delete(u.email);
    }
  }
}

async function seedUsers(t: SeedTenant) {
  // 1. Fetch all auth users and clean stale ones for this tenant's users
  const authByEmail = await listAllAuthUsers();
  await cleanStaleAuthUsers(t.users, authByEmail);

  for (const u of t.users) {
    // 2. Create auth user with deterministic id
    const { data: createData, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.fullName, role: u.role },
      id: u.id,
    });

    let authUserExists = false;

    if (error) {
      // "already exists" or "User already registered" → check by id to confirm
      if (/already/i.test(error.message)) {
        // Verify the existing user has our deterministic id
        const { data: existing } = await supabase.auth.admin.getUserById(u.id);
        if (existing?.user?.id === u.id) {
          authUserExists = true;
        } else {
          console.warn(`  [warn] createUser ${u.email}: ${error.message} — but getUserById(${u.id}) returned no match; skipping profile insert`);
        }
      } else {
        throw new Error(`createUser ${u.email}: ${error.message}`);
      }
    } else {
      // Successfully created
      authUserExists = createData?.user?.id === u.id;
      if (!authUserExists) {
        console.warn(`  [warn] createUser ${u.email}: created but returned id mismatch; skipping profile insert`);
      }
    }

    // 3. Only insert/upsert profile if auth user with our id exists
    if (authUserExists) {
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
}

// Catálogo de marcas demo (mismo set por tenant; cada uno crea sus propias
// filas tenant-scoped). Amplio y realista para poblar los selectores.
const CATALOGO_MARCAS: SeedMarca[] = [
  // Equipos (maquinaria pesada minera/forestal/construcción).
  ...[
    'Caterpillar',
    'Komatsu',
    'Sandvik',
    'Volvo',
    'Liebherr',
    'Hitachi',
    'Atlas Copco',
    'Epiroc',
    'John Deere',
    'Doosan',
    'Terex',
    'JCB',
    'Hyundai',
    'Tigercat',
    'Ponsse',
    'BOMAG',
  ].map((nombre) => ({ nombre, tipo: MarcaTipo.EQUIPO })),
  // Repuestos/insumos (filtros, lubricantes, neumáticos, rodamientos...).
  ...[
    'Shell',
    'Mobil',
    'Castrol',
    'Donaldson',
    'Fleetguard',
    'Mann-Filter',
    'Wix',
    'Baldwin',
    'SKF',
    'Gates',
    'Michelin',
    'Bridgestone',
    'Continental',
  ].map((nombre) => ({ nombre, tipo: MarcaTipo.REPUESTO })),
  // Ambos ámbitos (motores y componentes que aplican a equipo y repuesto).
  ...['Cummins', 'Bosch', 'Parker', 'Detroit Diesel'].map((nombre) => ({
    nombre,
    tipo: MarcaTipo.AMBOS,
  })),
];

// Marca por defecto para cada categoría de repuesto demo (debe existir en el
// catálogo con ámbito REPUESTO o AMBOS).
const MARCA_POR_CATEGORIA: Record<string, string> = {
  Filtros: 'Donaldson',
  Aceites: 'Shell',
  Frenos: 'Bosch',
  Eléctricos: 'Bosch',
  Hidráulica: 'Parker',
  Neumáticos: 'Michelin',
};

/**
 * Resuelve el id de una marca por nombre dentro del ámbito pedido (o AMBOS).
 * Si no existe, la crea en el ámbito indicado (robustez: cubre nombres de
 * equipos demo que no estén en el catálogo base). Idempotente.
 */
async function resolveMarcaId(
  tenantId: string,
  nombre: string,
  ambito: MarcaTipo,
): Promise<string | undefined> {
  if (!nombre) return undefined;
  const existente = await prisma.marca.findFirst({
    where: { tenantId, nombre, tipo: { in: [ambito, MarcaTipo.AMBOS] } },
    select: { id: true },
  });
  if (existente) return existente.id;
  const creada = await prisma.marca.upsert({
    where: { tenantId_nombre_tipo: { tenantId, nombre, tipo: ambito } },
    create: { tenantId, nombre, tipo: ambito },
    update: {},
    select: { id: true },
  });
  return creada.id;
}

async function seedMarcas(t: SeedTenant) {
  for (const m of CATALOGO_MARCAS) {
    await prisma.marca.upsert({
      where: {
        tenantId_nombre_tipo: { tenantId: t.id, nombre: m.nombre, tipo: m.tipo },
      },
      create: { tenantId: t.id, nombre: m.nombre, tipo: m.tipo },
      update: { activo: true }, // reactivar si quedó inactiva
    });
  }
}

/**
 * Resuelve el id del TipoEquipo (del catálogo del tenant) que corresponde a un
 * equipo, matcheando su `tipo`/`nombre` contra los `matchEquipos` declarados.
 * Devuelve el id determinista del spec (que seedTiposEquipo ya sembró).
 */
function resolveTipoEquipoId(t: SeedTenant, eq: SeedEquipo): string | undefined {
  if (!t.tiposEquipo) return undefined;
  const haystack = `${eq.tipo ?? ''} ${eq.nombre}`.toLowerCase();
  for (const te of t.tiposEquipo) {
    if (te.matchEquipos.some((m) => haystack.includes(m.toLowerCase()))) {
      return te.id;
    }
  }
  return undefined;
}

async function seedEquipos(t: SeedTenant) {
  for (const eq of t.equipos) {
    const marcaId = await resolveMarcaId(t.id, eq.marca, MarcaTipo.EQUIPO);
    const tipoEquipoId = resolveTipoEquipoId(t, eq);
    // qrToken: estable e idempotente — solo se genera la primera vez.
    await prisma.equipo.upsert({
      where: { tenantId_codigo: { tenantId: t.id, codigo: eq.codigo } },
      // Se conserva el texto legacy `marca` (via ...eq) y se enlaza marcaId.
      create: { ...eq, tenantId: t.id, marcaId, tipoEquipoId, qrToken: randomUUID() },
      update: {
        nombre: eq.nombre,
        marca: eq.marca,
        marcaId,
        tipo: eq.tipo,
        tipoEquipoId,
        modelo: eq.modelo,
        ubicacion: eq.ubicacion,
      },
    });
    // Garantiza qrToken si el registro existía sin token (idempotente).
    await prisma.equipo.updateMany({
      where: { tenantId: t.id, codigo: eq.codigo, qrToken: null },
      data: { qrToken: randomUUID() },
    });
  }
}

/**
 * Idempotente: upsert por (tenantId, codigo). El stock se crea solo la
 * primera vez; en re-ejecuciones no sobrescribimos el stockActual real para
 * no destruir movimientos posteriores. Si quieres re-cargar stock inicial,
 * borra inventario_stock antes del seed.
 */
async function seedRepuestos(t: SeedTenant) {
  if (!t.repuestos || t.repuestos.length === 0) return;

  for (const rep of t.repuestos) {
    const marcaNombre = rep.marcaNombre ?? MARCA_POR_CATEGORIA[rep.categoria];
    const marcaId = marcaNombre
      ? await resolveMarcaId(t.id, marcaNombre, MarcaTipo.REPUESTO)
      : undefined;

    const repuesto = await prisma.repuesto.upsert({
      where: { tenantId_codigo: { tenantId: t.id, codigo: rep.codigo } },
      create: {
        tenantId: t.id,
        codigo: rep.codigo,
        nombre: rep.nombre,
        descripcion: rep.descripcion,
        categoria: rep.categoria,
        unidad: rep.unidad,
        stockMinimo: rep.stockMinimo,
        marcaId,
        qrToken: randomUUID(),
      },
      update: {
        nombre: rep.nombre,
        descripcion: rep.descripcion,
        categoria: rep.categoria,
        unidad: rep.unidad,
        stockMinimo: rep.stockMinimo,
        marcaId,
      },
    });

    // Garantiza qrToken si el registro existía sin token (idempotente).
    await prisma.repuesto.updateMany({
      where: { tenantId: t.id, codigo: rep.codigo, qrToken: null },
      data: { qrToken: randomUUID() },
    });

    // Stock base: el stockActual/Reservado definitivo se RECALCULA luego en
    // seedReservas (resetStockBaseline) para reflejar reservas/consumos. Aquí
    // solo garantizamos que la fila exista con el stock inicial.
    await prisma.inventarioStock.upsert({
      where: { repuestoId: repuesto.id },
      create: {
        tenantId: t.id,
        repuestoId: repuesto.id,
        stockActual: rep.stockInicial,
        stockReservado: 0,
      },
      update: {}, // no sobrescribir aquí; seedReservas fija el valor coherente
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

// ============================================================
// Modelos nuevos de mantenimiento (tipos, plantillas, programaciones, reservas)
// ============================================================

/** Map codigo → repuesto.id para el tenant (resuelve referencias declarativas). */
async function repuestoIdByCodigo(
  tenantId: string,
): Promise<Map<string, string>> {
  const rows = await prisma.repuesto.findMany({
    where: { tenantId },
    select: { id: true, codigo: true },
  });
  return new Map(rows.map((r) => [r.codigo, r.id]));
}

/** Catálogo de tipos de equipo + sus repuestos default. Idempotente. */
async function seedTiposEquipo(t: SeedTenant) {
  if (!t.tiposEquipo || t.tiposEquipo.length === 0) return;
  const repByCodigo = await repuestoIdByCodigo(t.id);

  for (const te of t.tiposEquipo) {
    await prisma.tipoEquipo.upsert({
      where: { tenantId_nombre: { tenantId: t.id, nombre: te.nombre } },
      create: {
        id: te.id,
        tenantId: t.id,
        nombre: te.nombre,
        descripcion: te.descripcion,
      },
      update: { descripcion: te.descripcion, activo: true },
    });

    for (const def of te.repuestosDefault) {
      const repuestoId = repByCodigo.get(def.repuestoCodigo);
      if (!repuestoId) {
        console.warn(
          `  [warn] tipoEquipo ${te.nombre}: repuesto ${def.repuestoCodigo} inexistente — omitido`,
        );
        continue;
      }
      await prisma.tipoEquipoRepuestoDefault.upsert({
        where: {
          tenantId_tipoEquipoId_repuestoId: {
            tenantId: t.id,
            tipoEquipoId: te.id,
            repuestoId,
          },
        },
        create: {
          tenantId: t.id,
          tipoEquipoId: te.id,
          repuestoId,
          cantidadRef: def.cantidadRef,
          obligatorio: def.obligatorio ?? true,
          observacion: def.observacion,
        },
        update: {
          cantidadRef: def.cantidadRef,
          obligatorio: def.obligatorio ?? true,
          observacion: def.observacion,
        },
      });
    }
  }
}

/**
 * EquipoRepuesto derivado de los defaults del tipo de cada equipo (coherencia).
 * Idempotente: upsert por (tenant, equipo, repuesto).
 */
async function seedEquipoRepuestos(t: SeedTenant) {
  if (!t.tiposEquipo || t.tiposEquipo.length === 0) return;
  const tipoById = new Map(t.tiposEquipo.map((te) => [te.id, te]));

  for (const eq of t.equipos) {
    const tipoId = resolveTipoEquipoId(t, eq);
    if (!tipoId) continue;
    const tipo = tipoById.get(tipoId);
    if (!tipo) continue;

    for (const def of tipo.repuestosDefault) {
      const repuesto = await prisma.repuesto.findUnique({
        where: { tenantId_codigo: { tenantId: t.id, codigo: def.repuestoCodigo } },
        select: { id: true },
      });
      if (!repuesto) continue;

      await prisma.equipoRepuesto.upsert({
        where: {
          tenantId_equipoId_repuestoId: {
            tenantId: t.id,
            equipoId: eq.id,
            repuestoId: repuesto.id,
          },
        },
        create: {
          tenantId: t.id,
          equipoId: eq.id,
          repuestoId: repuesto.id,
          cantidadRef: def.cantidadRef,
          observacion: def.observacion ?? `Habitual de ${tipo.nombre}.`,
        },
        update: {
          cantidadRef: def.cantidadRef,
          observacion: def.observacion ?? `Habitual de ${tipo.nombre}.`,
        },
      });
    }
  }
}

/**
 * Plantillas de mantenimiento (con checklist en metadata e items) y su
 * asociación a los equipos del tipo. Idempotente (upsert por id / compuestos).
 */
async function seedPlantillas(t: SeedTenant) {
  if (!t.plantillas || t.plantillas.length === 0) return;
  const repByCodigo = await repuestoIdByCodigo(t.id);
  const tipoByNombre = new Map((t.tiposEquipo ?? []).map((te) => [te.nombre, te]));

  for (const pl of t.plantillas) {
    await prisma.plantillaMantenimiento.upsert({
      where: { id: pl.id },
      create: {
        id: pl.id,
        tenantId: t.id,
        nombre: pl.nombre,
        descripcion: pl.descripcion,
        tipoEquipo: pl.tipoEquipoNombre,
        frecuencia: pl.frecuencia,
        metadata: { checklist: pl.checklist },
      },
      update: {
        nombre: pl.nombre,
        descripcion: pl.descripcion,
        tipoEquipo: pl.tipoEquipoNombre,
        frecuencia: pl.frecuencia,
        activo: true,
        metadata: { checklist: pl.checklist },
      },
    });

    // Items (insumos sugeridos).
    for (const it of pl.items) {
      const repuestoId = repByCodigo.get(it.repuestoCodigo);
      if (!repuestoId) {
        console.warn(
          `  [warn] plantilla ${pl.nombre}: repuesto ${it.repuestoCodigo} inexistente — omitido`,
        );
        continue;
      }
      await prisma.plantillaMantenimientoItem.upsert({
        where: {
          tenantId_plantillaId_repuestoId: {
            tenantId: t.id,
            plantillaId: pl.id,
            repuestoId,
          },
        },
        create: {
          tenantId: t.id,
          plantillaId: pl.id,
          repuestoId,
          cantidad: it.cantidad,
          obligatorio: it.obligatorio ?? true,
          observacion: it.observacion,
        },
        update: {
          cantidad: it.cantidad,
          obligatorio: it.obligatorio ?? true,
          observacion: it.observacion,
        },
      });
    }

    // Asociación a los equipos del tipo de la plantilla.
    const tipo = tipoByNombre.get(pl.tipoEquipoNombre);
    if (!tipo) continue;
    for (const eq of t.equipos) {
      if (resolveTipoEquipoId(t, eq) !== tipo.id) continue;
      await prisma.equipoPlantillaMantenimiento.upsert({
        where: {
          tenantId_equipoId_plantillaId: {
            tenantId: t.id,
            equipoId: eq.id,
            plantillaId: pl.id,
          },
        },
        create: { tenantId: t.id, equipoId: eq.id, plantillaId: pl.id },
        update: {},
      });
    }
  }
}

/** Programaciones de mantenimiento (estados mezclados). Idempotente por id. */
async function seedProgramaciones(t: SeedTenant) {
  if (!t.programaciones || t.programaciones.length === 0) return;
  const plantillaIdByNombre = new Map(
    (t.plantillas ?? []).map((pl) => [pl.nombre, pl.id]),
  );

  for (const pr of t.programaciones) {
    const plantillaId = pr.plantillaNombre
      ? plantillaIdByNombre.get(pr.plantillaNombre) ?? null
      : null;
    const metadata =
      pr.estado === ProgramacionMantenimientoEstado.GENERADA && pr.generacion
        ? { generacion: pr.generacion }
        : undefined;

    const base = {
      tenantId: t.id,
      equipoId: pr.equipoId,
      plantillaId,
      titulo: pr.titulo,
      descripcion: pr.descripcion,
      fechaProgramada: hoursAgo(-pr.fechaProgramadaHoras),
      responsableId: pr.responsableId ?? null,
      prioridad: pr.prioridad,
      estado: pr.estado,
      recurrencia: pr.recurrencia,
      ...(metadata ? { metadata } : {}),
    };

    await prisma.programacionMantenimiento.upsert({
      where: { id: pr.id },
      create: { id: pr.id, ...base },
      update: base,
    });
  }
}

/**
 * Reservas de repuestos + items + movimientos, y RECÁLCULO del stock para que
 * cuadre. Idempotente: borra lo sembrado antes (por ids) y lo recrea; luego fija
 * stockActual/stockReservado de cada repuesto del tenant a su valor coherente.
 *
 * Consistencia (clave):
 *  - stockReservado(repuesto) = Σ cantidades de reservas activas
 *    (SOLICITADA + RESERVADA).
 *  - CONSUMIDA descuenta stockActual y genera MovimientoInventario CONSUMO.
 *  - stockActual(repuesto) = stockInicial − Σ consumos.
 */
async function seedReservas(t: SeedTenant) {
  const repByCodigo = await repuestoIdByCodigo(t.id);
  const reservas = t.reservas ?? [];
  const reservaIds = reservas.map((r) => r.id);

  // 1. Limpieza idempotente: primero movimientos ligados a estas reservas
  //    (FK aún intacta), luego las reservas (cascade borra sus items).
  if (reservaIds.length > 0) {
    await prisma.movimientoInventario.deleteMany({
      where: { tenantId: t.id, reservaId: { in: reservaIds } },
    });
    await prisma.reservaRepuesto.deleteMany({
      where: { tenantId: t.id, id: { in: reservaIds } },
    });
  }

  // 2. Acumuladores para el recálculo de stock.
  const reservadoPorRep = new Map<string, number>(); // solo RESERVADA retiene stock
  const consumidoPorRep = new Map<string, number>(); // CONSUMIDA

  // 3. Recrear reservas + items (+ movimientos CONSUMO).
  for (const r of reservas) {
    const items = r.items
      .map((it) => ({
        repuestoId: repByCodigo.get(it.repuestoCodigo),
        repuestoCodigo: it.repuestoCodigo,
        cantidad: it.cantidad,
      }))
      .filter((it): it is { repuestoId: string; repuestoCodigo: string; cantidad: number } => {
        if (!it.repuestoId) {
          console.warn(
            `  [warn] reserva ${r.id}: repuesto ${it.repuestoCodigo} inexistente — omitido`,
          );
          return false;
        }
        return true;
      });

    if (items.length === 0) continue;

    await prisma.reservaRepuesto.create({
      data: {
        id: r.id,
        tenantId: t.id,
        ticketId: r.ticketId,
        estado: r.estado,
        creadoPorId: r.creadoPorId,
        aprobadoPorId: r.aprobadoPorId ?? null,
        observacion: r.observacion,
        createdAt: hoursAgo(r.horasAtras),
        items: {
          create: items.map((it) => ({
            repuestoId: it.repuestoId,
            cantidad: it.cantidad,
          })),
        },
      },
    });

    // Solo RESERVADA retiene stockReservado; SOLICITADA (pendiente de aprobación)
    // no toca el stock hasta aprobarse — coincide con crearReservaEnTx del backend.
    const retieneStock = r.estado === ReservaRepuestoEstado.RESERVADA;

    for (const it of items) {
      if (retieneStock) {
        reservadoPorRep.set(
          it.repuestoId,
          (reservadoPorRep.get(it.repuestoId) ?? 0) + it.cantidad,
        );
      }
      if (r.estado === ReservaRepuestoEstado.CONSUMIDA) {
        consumidoPorRep.set(
          it.repuestoId,
          (consumidoPorRep.get(it.repuestoId) ?? 0) + it.cantidad,
        );
      }
    }
  }

  // 4. Recálculo del stock para TODOS los repuestos del tenant (también los no
  //    tocados → quedan en stockInicial / 0). stockInicial viene del spec.
  for (const rep of t.repuestos ?? []) {
    const repuestoId = repByCodigo.get(rep.codigo);
    if (!repuestoId) continue;

    const reservado = reservadoPorRep.get(repuestoId) ?? 0;
    const consumido = consumidoPorRep.get(repuestoId) ?? 0;
    const stockActual = rep.stockInicial - consumido;

    await prisma.inventarioStock.update({
      where: { repuestoId },
      data: { stockActual, stockReservado: reservado },
    });
  }

  // 5. Movimientos CONSUMO (uno por línea consumida). Idempotente: ya se
  //    borraron arriba por reservaId. stockResultante = snapshot final.
  for (const r of reservas) {
    if (r.estado !== ReservaRepuestoEstado.CONSUMIDA) continue;
    for (const it of r.items) {
      const repuestoId = repByCodigo.get(it.repuestoCodigo);
      if (!repuestoId) continue;
      const rep = (t.repuestos ?? []).find((x) => x.codigo === it.repuestoCodigo);
      const consumido = consumidoPorRep.get(repuestoId) ?? 0;
      const stockResultante = (rep?.stockInicial ?? 0) - consumido;

      await prisma.movimientoInventario.create({
        data: {
          tenantId: t.id,
          repuestoId,
          tipo: MovimientoInventarioTipo.CONSUMO,
          // Efecto negativo sobre stockActual.
          cantidad: -it.cantidad,
          stockResultante,
          usuarioId: r.creadoPorId,
          ticketId: r.ticketId,
          reservaId: r.id,
          observacion: `Consumo por reserva ${r.id}.`,
          createdAt: hoursAgo(r.horasAtras),
          metadata: { seed: true },
        },
      });
    }
  }
}

/**
 * Tickets generados desde plantilla: setea metadata.checklist con la forma
 * { paso: string, hecho: boolean } copiando los pasos de la plantilla asociada
 * a la programación GENERADA. Algunos pasos quedan en hecho:true (progreso).
 * Idempotente: reconstruye el checklist en cada corrida.
 */
async function seedTicketChecklists(t: SeedTenant) {
  if (!t.programaciones || t.programaciones.length === 0) return;
  const plantillaByNombre = new Map(
    (t.plantillas ?? []).map((pl) => [pl.nombre, pl]),
  );

  for (const pr of t.programaciones) {
    if (pr.estado !== ProgramacionMantenimientoEstado.GENERADA) continue;
    const ticketId = pr.generacion?.ticketId;
    if (!ticketId || !pr.plantillaNombre) continue;
    const plantilla = plantillaByNombre.get(pr.plantillaNombre);
    if (!plantilla) continue;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { metadata: true, estado: true },
    });
    if (!ticket) continue;

    // Ticket cerrado/ejecutado → todos los pasos hechos; en otro caso, ~mitad.
    const completo =
      ticket.estado === 'CERRADO' || ticket.estado === 'EJECUTADO';
    const checklist = plantilla.checklist.map((paso, idx) => ({
      paso,
      hecho: completo ? true : idx < Math.ceil(plantilla.checklist.length / 2),
    }));

    const prev =
      ticket.metadata && typeof ticket.metadata === 'object'
        ? (ticket.metadata as Record<string, unknown>)
        : {};

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { metadata: { ...prev, checklist } },
    });
  }
}

async function seedSingleTenant(t: SeedTenant) {
  // Orden por dependencias: catálogos (marcas, tipos) → repuestos(+stock) →
  // defaults por tipo → equipos(+qr,+tipo) → equipoRepuesto → plantillas(+items)
  // + equipoPlantilla → ordenes → tickets → programaciones → reservas(+ajuste de
  // stock/movimientos) → checklist en tickets → eventos.
  await seedTenantRow(t);
  await seedUsers(t);
  await seedMarcas(t);
  await seedRepuestos(t); // crea repuestos(+qr) y stock base; requerido por tipos
  await seedTiposEquipo(t); // tipos + defaults (refieren repuestos)
  await seedEquipos(t); // enlaza tipoEquipoId + qrToken
  await seedEquipoRepuestos(t); // derivados de los defaults del tipo
  await seedPlantillas(t); // plantillas(+items) + asociación a equipos
  await seedOrdenes(t);
  await seedTickets(t);
  await seedProgramaciones(t); // refiere plantillas + OT/ticket/reserva generadas
  await seedReservas(t); // reservas(+items+movimientos) + recálculo de stock
  await seedTicketChecklists(t); // metadata.checklist en tickets generados
  await seedEventos(t);
  console.log(
    `✓ ${t.id} — ${t.users.length} users, ${CATALOGO_MARCAS.length} marcas, ${t.equipos.length} equipos, ${t.repuestos?.length ?? 0} repuestos, ${t.tiposEquipo?.length ?? 0} tipos, ${t.plantillas?.length ?? 0} plantillas, ${t.programaciones?.length ?? 0} programaciones, ${t.reservas?.length ?? 0} reservas, ${t.ordenes.length} OT, ${t.tickets.length} tickets, ${t.eventos.length} eventos`,
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
      tipos: acc.tipos + (t.tiposEquipo?.length ?? 0),
      plantillas: acc.plantillas + (t.plantillas?.length ?? 0),
      programaciones: acc.programaciones + (t.programaciones?.length ?? 0),
      reservas: acc.reservas + (t.reservas?.length ?? 0),
    }),
    {
      users: 0,
      equipos: 0,
      ordenes: 0,
      tickets: 0,
      eventos: 0,
      tipos: 0,
      plantillas: 0,
      programaciones: 0,
      reservas: 0,
    },
  );
  console.log(
    `✓ Seed completado — ${TENANTS.length} tenants, ${totals.users} users, ${totals.equipos} equipos, ${totals.tipos} tipos, ${totals.plantillas} plantillas, ${totals.programaciones} programaciones, ${totals.reservas} reservas, ${totals.ordenes} OT, ${totals.tickets} tickets, ${totals.eventos} eventos`,
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
