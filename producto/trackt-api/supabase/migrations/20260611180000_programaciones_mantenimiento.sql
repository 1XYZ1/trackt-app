-- TRA: Fase 4 — calendario y programación de mantenimiento.
--
-- Modelo:
--   programaciones_mantenimiento — trabajo futuro planificado sobre un
--     equipo, opcionalmente basado en una plantilla de mantenimiento.
--     Estados: PROGRAMADA → GENERADA (OT creada, Fase 5) / CANCELADA;
--     VENCIDA y COMPLETADA se setean en Fase 5 (job / cierre de OT).
--
-- Compatibilidad:
--   - Solo enum + tabla nuevos; ninguna columna existente cambia.
--
-- Reglas de seguridad:
--   - Multi-tenant: tenant_id + indexes.
--   - RLS: lectura para el tenant autenticado; escritura admin/jefe_taller
--     (mismo criterio que plantillas_mantenimiento). El backend (service
--     role) bypassa RLS — el scoping se refuerza en los services.

-- =========================================================
-- 1. Enum ProgramacionMantenimientoEstado
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ProgramacionMantenimientoEstado'
  ) THEN
    CREATE TYPE "ProgramacionMantenimientoEstado" AS ENUM (
      'PROGRAMADA', 'GENERADA', 'CANCELADA', 'VENCIDA', 'COMPLETADA'
    );
  END IF;
END $$;

-- =========================================================
-- 2. Tabla programaciones_mantenimiento
-- =========================================================
CREATE TABLE IF NOT EXISTS "programaciones_mantenimiento" (
  "id"               TEXT NOT NULL,
  "tenant_id"        TEXT NOT NULL,
  "equipo_id"        TEXT NOT NULL,
  "plantilla_id"     TEXT,
  "titulo"           TEXT NOT NULL,
  "descripcion"      TEXT,
  "fecha_programada" TIMESTAMP(3) NOT NULL,
  "responsable_id"   TEXT,
  "prioridad"        "Prioridad" NOT NULL DEFAULT 'MEDIA',
  "estado"           "ProgramacionMantenimientoEstado" NOT NULL DEFAULT 'PROGRAMADA',
  "recurrencia"      TEXT,
  "metadata"         JSONB,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "programaciones_mantenimiento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "programaciones_mantenimiento_tenant_id_fecha_programada_idx"
  ON "programaciones_mantenimiento"("tenant_id", "fecha_programada");

CREATE INDEX IF NOT EXISTS "programaciones_mantenimiento_tenant_id_equipo_id_idx"
  ON "programaciones_mantenimiento"("tenant_id", "equipo_id");

CREATE INDEX IF NOT EXISTS "programaciones_mantenimiento_tenant_id_estado_idx"
  ON "programaciones_mantenimiento"("tenant_id", "estado");

CREATE INDEX IF NOT EXISTS "programaciones_mantenimiento_plantilla_id_idx"
  ON "programaciones_mantenimiento"("plantilla_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'programaciones_mantenimiento_tenant_id_fkey'
  ) THEN
    ALTER TABLE "programaciones_mantenimiento"
      ADD CONSTRAINT "programaciones_mantenimiento_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'programaciones_mantenimiento_equipo_id_fkey'
  ) THEN
    ALTER TABLE "programaciones_mantenimiento"
      ADD CONSTRAINT "programaciones_mantenimiento_equipo_id_fkey"
      FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'programaciones_mantenimiento_plantilla_id_fkey'
  ) THEN
    ALTER TABLE "programaciones_mantenimiento"
      ADD CONSTRAINT "programaciones_mantenimiento_plantilla_id_fkey"
      FOREIGN KEY ("plantilla_id") REFERENCES "plantillas_mantenimiento"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================
-- 3. RLS
-- =========================================================
ALTER TABLE "programaciones_mantenimiento" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programaciones_mantenimiento_select_tenant" ON "programaciones_mantenimiento";
CREATE POLICY "programaciones_mantenimiento_select_tenant"
  ON "programaciones_mantenimiento" FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id());

DROP POLICY IF EXISTS "programaciones_mantenimiento_write_admin_jefe" ON "programaciones_mantenimiento";
CREATE POLICY "programaciones_mantenimiento_write_admin_jefe"
  ON "programaciones_mantenimiento" FOR ALL TO authenticated
  USING (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  )
  WITH CHECK (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  );
