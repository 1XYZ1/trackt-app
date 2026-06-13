-- TRA: equipos como ficha central (Fase 1)
--
-- Agrega a `equipos` los campos de ficha tecnica y soporte QR:
--   tipo               TEXT      — categoria del equipo (excavadora, camion, etc.)
--   numero_serie       TEXT      — numero de serie del fabricante
--   estado_operativo   ENUM      — OPERATIVO | EN_MANTENIMIENTO | FUERA_DE_SERVICIO
--   fecha_instalacion  TIMESTAMP — puesta en marcha
--   fecha_compra       TIMESTAMP — adquisicion
--   qr_token           TEXT      — token estable y unico para resolver el equipo via QR.
--                                  No se guarda imagen; el frontend renderiza el QR
--                                  a partir del token. Regenerar invalida el anterior.
--
-- Indexes:
--   - qr_token UNIQUE (global: el token es opaco y no revela tenant).
--   - (tenant_id, estado_operativo) para dashboards/filtros por estado.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EquipoEstadoOperativo') THEN
    CREATE TYPE "EquipoEstadoOperativo" AS ENUM (
      'OPERATIVO', 'EN_MANTENIMIENTO', 'FUERA_DE_SERVICIO'
    );
  END IF;
END $$;

ALTER TABLE "equipos"
  ADD COLUMN IF NOT EXISTS "tipo"              TEXT,
  ADD COLUMN IF NOT EXISTS "numero_serie"      TEXT,
  ADD COLUMN IF NOT EXISTS "estado_operativo"  "EquipoEstadoOperativo" NOT NULL DEFAULT 'OPERATIVO',
  ADD COLUMN IF NOT EXISTS "fecha_instalacion" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "fecha_compra"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "qr_token"          TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "equipos_qr_token_key"
  ON "equipos"("qr_token");

CREATE INDEX IF NOT EXISTS "equipos_tenant_id_estado_operativo_idx"
  ON "equipos"("tenant_id", "estado_operativo");
