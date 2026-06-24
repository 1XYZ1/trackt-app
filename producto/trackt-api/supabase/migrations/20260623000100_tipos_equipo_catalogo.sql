-- TRA: catálogo de tipos de equipo + repuestos default por tipo.
--
-- Modelo:
--   tipos_equipo                  — catálogo maestro por tenant (nombre único).
--   tipos_equipo_repuesto_default — repuestos default de cada tipo; al crear un
--                                   equipo con tipo_equipo_id se copian a
--                                   equipos_repuestos.
--   equipos                       — gana tipo_equipo_id (FK a tipos_equipo,
--                                   ON DELETE SET NULL). El texto equipos.tipo
--                                   se conserva como legacy.
--
-- Compatibilidad:
--   - Solo tablas/columnas nuevas; ninguna existente cambia ni se elimina.
--
-- Reglas de seguridad:
--   - Multi-tenant: tenant_id + index en las tablas nuevas.
--   - RLS siguiendo el patrón de equipos_repuestos: lectura para el tenant
--     autenticado; escritura admin/jefe_taller. El backend (service role)
--     bypassa RLS — el scoping se refuerza en los services.

-- =========================================================
-- 1. Tabla tipos_equipo
-- =========================================================
CREATE TABLE IF NOT EXISTS "tipos_equipo" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "nombre"      TEXT NOT NULL,
  "descripcion" TEXT,
  "activo"      BOOLEAN NOT NULL DEFAULT true,
  "metadata"    JSONB,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tipos_equipo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tipos_equipo_tenant_id_nombre_key"
  ON "tipos_equipo"("tenant_id", "nombre");

CREATE INDEX IF NOT EXISTS "tipos_equipo_tenant_id_activo_idx"
  ON "tipos_equipo"("tenant_id", "activo");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tipos_equipo_tenant_id_fkey'
  ) THEN
    ALTER TABLE "tipos_equipo"
      ADD CONSTRAINT "tipos_equipo_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================
-- 2. Tabla tipos_equipo_repuesto_default
-- =========================================================
CREATE TABLE IF NOT EXISTS "tipos_equipo_repuesto_default" (
  "id"             TEXT NOT NULL,
  "tenant_id"      TEXT NOT NULL,
  "tipo_equipo_id" TEXT NOT NULL,
  "repuesto_id"    TEXT NOT NULL,
  "cantidad_ref"   INTEGER,
  "obligatorio"    BOOLEAN NOT NULL DEFAULT true,
  "observacion"    TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tipos_equipo_repuesto_default_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tipos_equipo_repuesto_default_cantidad_ref_positiva"
    CHECK ("cantidad_ref" IS NULL OR "cantidad_ref" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "tipos_equipo_repuesto_default_tenant_tipo_repuesto_key"
  ON "tipos_equipo_repuesto_default"("tenant_id", "tipo_equipo_id", "repuesto_id");

CREATE INDEX IF NOT EXISTS "tipos_equipo_repuesto_default_tenant_id_tipo_equipo_id_idx"
  ON "tipos_equipo_repuesto_default"("tenant_id", "tipo_equipo_id");

CREATE INDEX IF NOT EXISTS "tipos_equipo_repuesto_default_repuesto_id_idx"
  ON "tipos_equipo_repuesto_default"("repuesto_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tipos_equipo_repuesto_default_tenant_id_fkey'
  ) THEN
    ALTER TABLE "tipos_equipo_repuesto_default"
      ADD CONSTRAINT "tipos_equipo_repuesto_default_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tipos_equipo_repuesto_default_tipo_equipo_id_fkey'
  ) THEN
    ALTER TABLE "tipos_equipo_repuesto_default"
      ADD CONSTRAINT "tipos_equipo_repuesto_default_tipo_equipo_id_fkey"
      FOREIGN KEY ("tipo_equipo_id") REFERENCES "tipos_equipo"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tipos_equipo_repuesto_default_repuesto_id_fkey'
  ) THEN
    ALTER TABLE "tipos_equipo_repuesto_default"
      ADD CONSTRAINT "tipos_equipo_repuesto_default_repuesto_id_fkey"
      FOREIGN KEY ("repuesto_id") REFERENCES "repuestos"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================
-- 3. equipos.tipo_equipo_id (FK al catálogo)
-- =========================================================
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "tipo_equipo_id" TEXT;

CREATE INDEX IF NOT EXISTS "equipos_tipo_equipo_id_idx"
  ON "equipos"("tipo_equipo_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'equipos_tipo_equipo_id_fkey'
  ) THEN
    ALTER TABLE "equipos"
      ADD CONSTRAINT "equipos_tipo_equipo_id_fkey"
      FOREIGN KEY ("tipo_equipo_id") REFERENCES "tipos_equipo"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================
-- 4. RLS
-- =========================================================
ALTER TABLE "tipos_equipo"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tipos_equipo_repuesto_default" ENABLE ROW LEVEL SECURITY;

-- tipos_equipo: lectura para el tenant (formularios); escritura admin/jefe_taller.
DROP POLICY IF EXISTS "tipos_equipo_select_tenant" ON "tipos_equipo";
CREATE POLICY "tipos_equipo_select_tenant"
  ON "tipos_equipo" FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id());

DROP POLICY IF EXISTS "tipos_equipo_write_admin_jefe" ON "tipos_equipo";
CREATE POLICY "tipos_equipo_write_admin_jefe"
  ON "tipos_equipo" FOR ALL TO authenticated
  USING (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  )
  WITH CHECK (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  );

-- tipos_equipo_repuesto_default: mismo criterio.
DROP POLICY IF EXISTS "tipos_equipo_repuesto_default_select_tenant" ON "tipos_equipo_repuesto_default";
CREATE POLICY "tipos_equipo_repuesto_default_select_tenant"
  ON "tipos_equipo_repuesto_default" FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id());

DROP POLICY IF EXISTS "tipos_equipo_repuesto_default_write_admin_jefe" ON "tipos_equipo_repuesto_default";
CREATE POLICY "tipos_equipo_repuesto_default_write_admin_jefe"
  ON "tipos_equipo_repuesto_default" FOR ALL TO authenticated
  USING (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  )
  WITH CHECK (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  );
