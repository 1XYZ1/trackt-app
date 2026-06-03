import { authFetch } from "@/lib/api/http";

export type NotificacionTipo =
  | "TICKET_ASIGNADO"
  | "TICKET_INICIADO"
  | "TICKET_FINALIZADO"
  | "TICKET_VALIDADO"
  | "TICKET_RECHAZADO"
  | "TICKET_CERRADO"
  | "OT_CREADA"
  | "OT_CERRADA";

export interface NotificacionPayload {
  ticketId?: string;
  ticketCodigo?: string;
  ticketTitulo?: string;
  ordenId?: string;
  ordenCodigo?: string;
  observacion?: string;
  actor?: { id: string; fullName?: string | null };
  mensaje?: string;
  [key: string]: unknown;
}

export interface Notificacion {
  id: string;
  tipo: NotificacionTipo;
  payload: NotificacionPayload;
  leida: boolean;
  createdAt: string;
}

export interface ListNotificacionesParams {
  page?: number;
  limit?: number;
  soloNoLeidas?: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

function assertApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL no esta configurada");
  }
}

export async function getNotificaciones(
  params: ListNotificacionesParams = {},
): Promise<{ data: Notificacion[]; meta: { total: number } }> {
  assertApiBaseUrl();

  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.soloNoLeidas) qs.set("soloNoLeidas", "true");

  const url = `${API_BASE_URL}/notificaciones${qs.toString() ? `?${qs.toString()}` : ""}`;
  const response = await authFetch(url);

  if (!response.ok) {
    throw new Error("No se pudieron cargar las notificaciones");
  }
  return response.json();
}

export async function getCountNoLeidas(): Promise<number> {
  assertApiBaseUrl();
  const response = await authFetch(
    `${API_BASE_URL}/notificaciones/count-no-leidas`,
  );
  // Lanzar ante error (como el resto de fns): devolver 0 enmascaraba fallos
  // reales (401 de sesion expirada, 500) haciendo desaparecer el badge.
  if (!response.ok) {
    throw new Error("No se pudo obtener el conteo de notificaciones");
  }
  const data = (await response.json()) as { count: number };
  return data.count;
}

export async function marcarLeida(id: string): Promise<void> {
  assertApiBaseUrl();
  const response = await authFetch(
    `${API_BASE_URL}/notificaciones/${id}/leer`,
    { method: "PATCH" },
  );
  if (!response.ok && response.status !== 204) {
    throw new Error("No se pudo marcar como leida");
  }
}

export async function marcarTodasLeidas(): Promise<{ count: number }> {
  assertApiBaseUrl();
  const response = await authFetch(
    `${API_BASE_URL}/notificaciones/leer-todas`,
    { method: "PATCH" },
  );
  if (!response.ok) {
    throw new Error("No se pudo marcar todas como leidas");
  }
  return response.json();
}
