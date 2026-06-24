-- TRA: repuestos.qr_token — identificación de repuesto vía QR.
--
-- Modelo:
--   repuestos gana qr_token (TEXT, único global), espejando equipos.qr_token
--   (migración 20260610000000_equipos_ficha). El front renderiza el QR desde
--   la URL navegable; no se persiste imagen.
--
-- Compatibilidad:
--   - Columna nueva nuleable; ninguna columna existente cambia.
--   - El índice único permite múltiples NULL (semántica estándar de Postgres).
--
-- RLS: repuestos ya tiene políticas; agregar una columna no las altera.

ALTER TABLE "repuestos" ADD COLUMN IF NOT EXISTS "qr_token" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "repuestos_qr_token_key"
  ON "repuestos"("qr_token");
