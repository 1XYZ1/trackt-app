import type { Equipo } from "@/lib/api/equipos";
import { authFetch } from "@/lib/api/http";
import type { TicketResumen, TracktEstado, UsuarioResumen } from "@/components/core";

export type OrdenEstado = TracktEstado;
export type OrdenPrioridad = "BAJA" | "MEDIA" | "ALTA";

export type OrdenTrabajo = {
  id: string;
  codigo: string;
  equipoId: string;
  equipo?: Equipo | null;
  descripcion: string;
  estado: OrdenEstado;
  prioridad: OrdenPrioridad;
  createdAt: string;
  responsable?: UsuarioResumen | null;
  tickets?: TicketResumen[];
};

export type CreateOrdenPayload = {
  equipoId: string;
  descripcion: string;
  prioridad: OrdenPrioridad;
  // Plantilla opcional: la OT nace con un ticket que copia el checklist de la
  // plantilla y reserva sus insumos (igual que Programación → Generar OT).
  plantillaId?: string;
};

export type OrdenesFilters = {
  estado?: OrdenEstado | "TODOS";
  equipoId?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

function assertApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL no esta configurada");
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error("No se pudieron cargar las ordenes de trabajo");
  }

  return response.json();
}

// Backend OrdenTrabajoEstado: PENDIENTE | EN_PROCESO | CERRADA | CANCELADA
// Frontend TracktEstado:      PENDIENTE | ASIGNADO | EN_EJECUCION | EJECUTADO | CERRADO | CANCELADO
// StatusBadge usa el enum frontend — mapear para evitar undefined lookup.
function adaptOrdenEstado(estado: string): OrdenEstado {
  const map: Record<string, OrdenEstado> = {
    PENDIENTE: "PENDIENTE",
    EN_PROCESO: "EN_EJECUCION",
    CERRADA: "CERRADO",
    CANCELADA: "CANCELADO",
    // passthrough por si backend converge al enum del frontend
    ASIGNADO: "ASIGNADO",
    EN_EJECUCION: "EN_EJECUCION",
    EJECUTADO: "EJECUTADO",
    CERRADO: "CERRADO",
    CANCELADO: "CANCELADO",
  };
  return map[estado] ?? "PENDIENTE";
}

function adaptOrden(orden: OrdenTrabajo): OrdenTrabajo {
  return { ...orden, estado: adaptOrdenEstado(orden.estado) };
}

type PaginatedOrdenes = {
  data: OrdenTrabajo[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

// Máximo permitido por PaginationQueryDto del backend (@Max(100)).
const ORDENES_PAGE_SIZE = 100;

async function fetchOrdenesPage(page: number): Promise<PaginatedOrdenes> {
  const response = await authFetch(
    `${API_BASE_URL}/ordenes?page=${page}&limit=${ORDENES_PAGE_SIZE}`,
  );
  return parseJsonResponse<PaginatedOrdenes>(response);
}

// Recorre todas las páginas: el backend pagina con limit por defecto 10, así que
// pedir sin paginar truncaba la lista (y los conteos del summary) a 10 OT.
export async function getOrdenes(): Promise<OrdenTrabajo[]> {
  assertApiBaseUrl();

  const first = await fetchOrdenesPage(1);
  if (first.meta.totalPages <= 1) return first.data.map(adaptOrden);

  const restPages = Array.from(
    { length: first.meta.totalPages - 1 },
    (_, i) => i + 2,
  );
  const rest = await Promise.all(restPages.map(fetchOrdenesPage));
  return [first.data, ...rest.map((r) => r.data)].flat().map(adaptOrden);
}

export async function getOrdenById(id: string): Promise<OrdenTrabajo> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/ordenes/${id}`);
  const orden = await parseJsonResponse<OrdenTrabajo>(response);
  return adaptOrden(orden);
}

// Descarga el PDF de la OT (StreamableFile application/pdf). Lee blob, NO json,
// y lo abre en una pestaña nueva (inline).
export async function descargarPdfOrden(id: string): Promise<void> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/ordenes/${id}/pdf`);
  if (!response.ok) {
    throw new Error("No se pudo generar el PDF de la orden");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  // Revoca tras dar tiempo a la pestaña a cargar el recurso.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Mensaje de error de creación de OT. Con plantilla, el backend puede devolver
// un 409 estructurado de stock insuficiente { message, faltantes } — lo
// desglosamos igual que generarOt para que el usuario vea qué falta.
async function extractCreateOrdenError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: string | string[];
      faltantes?: Array<{
        codigo: string;
        nombre: string;
        requerido: number;
        disponible: number;
      }>;
    };
    if (
      typeof body.message === "string" &&
      body.message &&
      body.faltantes?.length
    ) {
      const detalle = body.faltantes
        .map(
          (f) =>
            `${f.codigo} (disponible ${f.disponible}, requerido ${f.requerido})`,
        )
        .join(", ");
      return `${body.message}: ${detalle}`;
    }
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string" && body.message) return body.message;
  } catch {
    // sin body json
  }
  return "No se pudo crear la orden de trabajo";
}

export async function createOrden(
  payload: CreateOrdenPayload,
): Promise<OrdenTrabajo> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/ordenes`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await extractCreateOrdenError(response));
  }

  return adaptOrden(await response.json());
}
