import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

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
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) return response;

  return fetchWithToken(input, init);
}

async function fetchWithToken(
  input: string,
  init: RequestInit,
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(input, { ...init, headers });
}
