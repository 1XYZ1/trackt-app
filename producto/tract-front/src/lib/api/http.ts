import { createClient } from "@/lib/supabase/client";

// Cliente browser perezoso: NO crear a nivel de módulo. Si un módulo de servidor
// importa esta cadena (ej. tickets.server.ts → tickets.ts → http.ts) durante el
// build, un createClient() a nivel de módulo se evaluaría en el servidor y
// lanzaría sin env de Supabase. Creándolo bajo demanda, solo corre en el browser.
let supabaseClient: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  return (supabaseClient ??= createClient());
}

/**
 * Fetch wrapper que adjunta el access_token de Supabase como Bearer.
 *
 * Comportamiento de refresh:
 * - `supabase.auth.getSession()` retorna la sesión actual; si está cerca de
 *   expirar y `autoRefreshToken` está activo (default en createBrowserClient),
 *   el SDK refresca transparente.
 * - Si la respuesta es 401, intentamos `refreshSession()` explícito y reintentamos
 *   una vez (cubre el caso de un access_token que expiró entre getSession y fetch).
 */
export async function authFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetchWithToken(input, init);

  if (response.status !== 401) return response;

  // Retry una vez tras forzar refresh — el access_token pudo expirar entre
  // getSession() y la llegada del request al backend.
  const { data, error } = await getSupabase().auth.refreshSession();
  if (error || !data.session) return response;

  return fetchWithToken(input, init);
}

async function fetchWithToken(
  input: string,
  init: RequestInit,
): Promise<Response> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(input, { ...init, headers });
}
