/**
 * Base pública del frontend usada para construir las URLs que codifican los
 * QR. Debe coincidir con lo que arma el frontend:
 *   - Equipos:   `${SITE_URL}/q/${qrToken}`
 *   - Repuestos: `${SITE_URL}/r/${qrToken}`
 *
 * Configurable vía el env `PUBLIC_SITE_URL` (sin slash final). Si no se define,
 * cae al dominio demo de Vercel.
 */
export const SITE_URL = (
  process.env.PUBLIC_SITE_URL ?? 'https://trackt-front.vercel.app'
).replace(/\/$/, '');
