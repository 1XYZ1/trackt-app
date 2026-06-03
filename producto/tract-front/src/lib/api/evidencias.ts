import { authFetch } from "@/lib/api/http";

export type Evidencia = {
  id: string;
  ticketId: string;
  storagePath: string;
  descripcion?: string | null;
  subidoPorId: string;
  createdAt: string;
  // El backend puede devolver null si no logra firmar la URL; la UI lo maneja
  // con un placeholder. Tiparlo evita asumir un string siempre presente.
  downloadUrl: string | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

function assertApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL no esta configurada");
  }
}

/**
 * Lista evidencias del ticket con downloadUrl firmada (TTL ~5 min).
 * Backend filtra por acceso al ticket (admin del tenant o mecánico asignado).
 */
export async function getEvidencias(ticketId: string): Promise<Evidencia[]> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/tickets/${ticketId}/evidencias`,
  );

  if (response.status === 403 || response.status === 404) {
    // El usuario no tiene acceso (RLS) o el ticket no existe en su tenant.
    return [];
  }

  if (!response.ok) {
    throw new Error("No se pudieron cargar las evidencias");
  }

  return response.json();
}
