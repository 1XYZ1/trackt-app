import type { TicketEstado, UsuarioResumen } from "@/components/core";
import { authFetch } from "@/lib/api/http";
import { createClient } from "@/lib/supabase/client";
import type { TicketTrabajo } from "@/lib/api/tickets";

const supabase = createClient();

export type MisTicketPrioridad = "BAJA" | "MEDIA" | "ALTA";

export type TicketEvidence = {
  id: string;
  fileName: string;
  url: string;
  createdAt: string;
};

export type MisTicket = {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  equipo: string;
  estado: Extract<TicketEstado, "ASIGNADO" | "EN_EJECUCION" | "EJECUTADO">;
  prioridad: MisTicketPrioridad;
  ordenId: string;
  ordenCodigo: string;
  mecanico?: UsuarioResumen | null;
  evidencias: TicketEvidence[];
};

export type FinalizarTicketPayload = {
  observacion: string;
};

// Shape de las evidencias del backend (POST /tickets/:id/evidencia + GET listForTicket)
type EvidenciaResponseDto = {
  id: string;
  ticketId: string;
  storagePath: string;
  descripcion?: string | null;
  subidoPorId: string;
  createdAt: string;
  downloadUrl: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const mockTickets: MisTicket[] = [
  {
    codigo: "ITCM-1042",
    descripcion:
      "Revisar fuga hidraulica reportada durante inspeccion previa al turno.",
    equipo: "CAT 793F - Camion CA-22",
    estado: "ASIGNADO",
    evidencias: [],
    id: "mock-ticket-1",
    mecanico: {
      email: "mecanico@trackt.local",
      nombre: "Mecanico Demo",
    },
    ordenCodigo: "OT-1187",
    ordenId: "ot-1187",
    prioridad: "ALTA",
    titulo: "Fuga hidraulica en linea principal",
  },
  {
    codigo: "ITCM-1043",
    descripcion:
      "Cambiar filtro y registrar evidencia visual antes de finalizar.",
    equipo: "Komatsu WA900 - Cargador CL-08",
    estado: "EN_EJECUCION",
    evidencias: [
      {
        createdAt: new Date().toISOString(),
        fileName: "evidencia-inicial.jpg",
        id: "evidencia-1",
        url: "https://placehold.co/480x360/171717/f8f8f8?text=Evidencia",
      },
    ],
    id: "mock-ticket-2",
    mecanico: {
      email: "mecanico@trackt.local",
      nombre: "Mecanico Demo",
    },
    ordenCodigo: "OT-1190",
    ordenId: "ot-1190",
    prioridad: "MEDIA",
    titulo: "Cambio de filtro hidraulico",
  },
];

function assertApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL no esta configurada");
  }
}

async function parseJsonResponse<T>(
  response: Response,
  errorMessage: string,
): Promise<T> {
  if (!response.ok) {
    throw new Error(errorMessage);
  }

  return response.json();
}

// Mocks solo si se opta explicitamente (NEXT_PUBLIC_USE_MOCKS="true"). Nunca
// por defecto: evita que un error real (401 de sesion expirada, 500) muestre
// datos ficticios en dev/staging. Las mutaciones NUNCA se mockean.
const USE_MOCK_FALLBACK = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

function cloneMockTickets() {
  return structuredClone(mockTickets);
}

function logFallback(scope: string, err: unknown) {
  if (typeof console !== "undefined") {
    console.warn(`[mis-tickets:${scope}] usando mock por error:`, err);
  }
}

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Sin sesión activa");
  return user.id;
}

function adaptEvidencia(e: EvidenciaResponseDto): TicketEvidence {
  return {
    id: e.id,
    fileName: e.storagePath.split("/").pop() ?? e.storagePath,
    url: e.downloadUrl,
    createdAt: e.createdAt,
  };
}

function adaptToMisTicket(
  ticket: TicketTrabajo,
  evidencias: TicketEvidence[] = [],
): MisTicket {
  const equipoLabel = ticket.equipo
    ? `${ticket.equipo.codigo} - ${ticket.equipo.nombre}`
    : ticket.equipoNombre ?? "Equipo sin informacion";

  return {
    id: ticket.id,
    codigo: ticket.codigo,
    titulo: ticket.titulo,
    descripcion: ticket.descripcion,
    equipo: equipoLabel,
    estado: ticket.estado as MisTicket["estado"],
    prioridad: ticket.prioridad,
    ordenId: ticket.ordenId,
    ordenCodigo: ticket.ordenCodigo ?? "",
    mecanico: ticket.mecanico,
    evidencias,
  };
}

export async function getMisTickets(): Promise<MisTicket[]> {
  try {
    assertApiBaseUrl();
    const userId = await getCurrentUserId();

    const response = await authFetch(
      `${API_BASE_URL}/tickets?mecanicoId=${userId}&limit=100`,
    );
    const result = await parseJsonResponse<{ data: TicketTrabajo[] }>(
      response,
      "No se pudieron cargar tus tickets",
    );

    return result.data
      .filter((ticket) =>
        ["ASIGNADO", "EN_EJECUCION"].includes(ticket.estado),
      )
      .map((t) => adaptToMisTicket(t));
  } catch (err) {
    if (!USE_MOCK_FALLBACK) throw err;
    logFallback("getMisTickets", err);
    return cloneMockTickets().filter((ticket) =>
      ["ASIGNADO", "EN_EJECUCION"].includes(ticket.estado),
    );
  }
}

export async function getMiTicketById(id: string): Promise<MisTicket> {
  try {
    assertApiBaseUrl();

    const [ticketResp, evidenciasResp] = await Promise.all([
      authFetch(`${API_BASE_URL}/tickets/${id}`),
      authFetch(`${API_BASE_URL}/tickets/${id}/evidencias`),
    ]);

    const ticket = await parseJsonResponse<TicketTrabajo>(
      ticketResp,
      "No se pudo cargar el ticket",
    );
    const evidencias = evidenciasResp.ok
      ? ((await evidenciasResp.json()) as EvidenciaResponseDto[]).map(
          adaptEvidencia,
        )
      : [];

    return adaptToMisTicket(ticket, evidencias);
  } catch (err) {
    if (!USE_MOCK_FALLBACK) throw err;
    logFallback("getMiTicketById", err);
    const ticket = cloneMockTickets().find((item) => item.id === id);

    if (!ticket) {
      throw new Error("No se pudo cargar el ticket");
    }

    return ticket;
  }
}

export async function iniciarEjecucion(ticketId: string): Promise<MisTicket> {
  // Mutacion: nunca se mockea — un fallo debe propagarse al usuario.
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/tickets/${ticketId}/iniciar`,
    { method: "POST" },
  );

  const ticket = await parseJsonResponse<TicketTrabajo>(
    response,
    "No se pudo iniciar el trabajo",
  );
  return adaptToMisTicket(ticket);
}

export async function subirEvidencia(
  ticketId: string,
  file: File,
): Promise<TicketEvidence> {
  // Mutacion: nunca se mockea — un fallo debe propagarse al usuario.
  assertApiBaseUrl();

    // 1. Pedir signed URL al backend. El DTO espera { mime, size }.
    const signedUrlResponse = await authFetch(
      `${API_BASE_URL}/tickets/${ticketId}/evidencia/signed-url`,
      {
        body: JSON.stringify({
          mime: file.type,
          size: file.size,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    const signedUrl = await parseJsonResponse<{
      uploadUrl: string;
      token: string;
      storagePath: string;
      expiresIn: number;
    }>(signedUrlResponse, "No se pudo preparar la subida");

    // 2. PUT al storage. Supabase signed URL típicamente acepta auth header
    // Bearer ${token} o el token incrustado en el URL — el backend retorna
    // ambos para que el cliente decida. Probamos con Bearer.
    const uploadResponse = await fetch(signedUrl.uploadUrl, {
      body: file,
      headers: {
        "Content-Type": file.type,
        Authorization: `Bearer ${signedUrl.token}`,
      },
      method: "PUT",
    });

    if (!uploadResponse.ok) {
      throw new Error("No se pudo subir la evidencia al storage");
    }

    // 3. Confirmar al backend que el archivo ya está subido
    const confirmResponse = await authFetch(
      `${API_BASE_URL}/tickets/${ticketId}/evidencia`,
      {
        body: JSON.stringify({
          storagePath: signedUrl.storagePath,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    const evidencia = await parseJsonResponse<EvidenciaResponseDto>(
      confirmResponse,
      "No se pudo confirmar la evidencia",
    );

    return adaptEvidencia(evidencia);
}

export async function finalizarEjecucion(
  ticketId: string,
  payload: FinalizarTicketPayload,
): Promise<MisTicket> {
  // Mutacion: nunca se mockea — un fallo debe propagarse al usuario.
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/tickets/${ticketId}/finalizar`,
    {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  const ticket = await parseJsonResponse<TicketTrabajo>(
    response,
    "No se pudo finalizar el trabajo",
  );
  return adaptToMisTicket(ticket);
}
