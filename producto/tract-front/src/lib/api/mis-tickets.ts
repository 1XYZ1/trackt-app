import type { TicketEstado, UsuarioResumen } from "@/components/core";

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

// TODO(api): quitar fallback mock cuando API-05 este disponible en backend.
const USE_MOCK_FALLBACK = process.env.NODE_ENV !== "production";

function cloneMockTickets() {
  return structuredClone(mockTickets);
}

function logFallback(scope: string, err: unknown) {
  if (typeof console !== "undefined") {
    console.warn(`[mis-tickets:${scope}] usando mock por error:`, err);
  }
}

export async function getMisTickets(): Promise<MisTicket[]> {
  try {
    assertApiBaseUrl();

    const response = await fetch(`${API_BASE_URL}/mis-tickets`);
    const tickets = await parseJsonResponse<MisTicket[]>(
      response,
      "No se pudieron cargar tus tickets",
    );

    return tickets.filter((ticket) =>
      ["ASIGNADO", "EN_EJECUCION"].includes(ticket.estado),
    );
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

    const response = await fetch(`${API_BASE_URL}/mis-tickets/${id}`);
    return parseJsonResponse<MisTicket>(
      response,
      "No se pudo cargar el ticket",
    );
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
  try {
    assertApiBaseUrl();

    const response = await fetch(
      `${API_BASE_URL}/tickets/${ticketId}/iniciar-ejecucion`,
      { method: "POST" },
    );

    return parseJsonResponse<MisTicket>(
      response,
      "No se pudo iniciar el trabajo",
    );
  } catch (err) {
    if (!USE_MOCK_FALLBACK) throw err;
    logFallback("iniciarEjecucion", err);
    const ticket = await getMiTicketById(ticketId);
    return { ...ticket, estado: "EN_EJECUCION" };
  }
}

export async function subirEvidencia(
  ticketId: string,
  file: File,
): Promise<TicketEvidence> {
  try {
    assertApiBaseUrl();

    const signedUrlResponse = await fetch(
      `${API_BASE_URL}/tickets/${ticketId}/evidencias/signed-url`,
      {
        body: JSON.stringify({
          contentType: file.type,
          fileName: file.name,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    const signedUrl = await parseJsonResponse<{
      uploadUrl: string;
      publicUrl: string;
      evidenceId: string;
    }>(signedUrlResponse, "No se pudo preparar la subida");

    const uploadResponse = await fetch(signedUrl.uploadUrl, {
      body: file,
      headers: {
        "Content-Type": file.type,
      },
      method: "PUT",
    });

    if (!uploadResponse.ok) {
      throw new Error("No se pudo subir la evidencia");
    }

    return {
      createdAt: new Date().toISOString(),
      fileName: file.name,
      id: signedUrl.evidenceId,
      url: signedUrl.publicUrl,
    };
  } catch (err) {
    if (!USE_MOCK_FALLBACK) throw err;
    logFallback("subirEvidencia", err);
    return {
      createdAt: new Date().toISOString(),
      fileName: file.name,
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
    };
  }
}

export async function finalizarEjecucion(
  ticketId: string,
  payload: FinalizarTicketPayload,
): Promise<MisTicket> {
  try {
    assertApiBaseUrl();

    const response = await fetch(
      `${API_BASE_URL}/tickets/${ticketId}/finalizar-ejecucion`,
      {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    return parseJsonResponse<MisTicket>(
      response,
      "No se pudo finalizar el trabajo",
    );
  } catch (err) {
    if (!USE_MOCK_FALLBACK) throw err;
    logFallback("finalizarEjecucion", err);
    const ticket = await getMiTicketById(ticketId);
    return { ...ticket, estado: "EJECUTADO" };
  }
}
