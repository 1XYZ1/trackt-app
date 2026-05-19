-- TRA: baja lógica de equipos
--
-- Agrega la columna `activo` (default true) y un índice compuesto
-- (tenant_id, activo) para acelerar el listado por defecto que filtra
-- equipos activos por tenant.

ALTER TABLE "equipos"
  ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "equipos_tenant_id_activo_idx"
  ON "equipos"("tenant_id", "activo");
