-- TRA: Fase 3 — plantillas de mantenimiento con insumos.
--
-- Modelo:
--   plantillas_mantenimiento         — "receta" reutilizable por tenant:
--                                      nombre, tipo de equipo al que aplica,
--                                      frecuencia sugerida y checklist en
--                                      metadata.checklist (string[]).
--   plantillas_mantenimiento_items   — insumos sugeridos de la plantilla
--                                      (repuesto + cantidad; obligatorio
--                                      distingue insumos opcionales).
--   equipos_plantillas_mantenimiento — qué plantillas aplican a cada equipo.
--
-- Compatibilidad:
--   - Solo tablas nuevas; ninguna columna existente cambia ni se elimina.
--
-- Reglas de seguridad:
--   - Multi-tenant: tenant_id + index en las tres tablas.
--   - RLS siguiendo el patrón de equipos_repuestos: lectura para el tenant
--     autenticado; escritura admin/jefe_taller. El backend (service role)
--     bypassa RLS — el scoping se refuerza en los services.

-- =========================================================
-- 1. Tabla plantillas_mantenimiento
-- =========================================================
CREATE TABLE IF NOT EXISTS "plantillas_mantenimiento" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "nombre"      TEXT NOT NULL,
  "descripcion" TEXT,
  "tipo_equipo" TEXT,
  "frecuencia"  TEXT,
  "activo"      BOOLEAN NOT NULL DEFAULT true,
  "metadata"    JSONB,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "plantillas_mantenimiento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "plantillas_mantenimiento_tenant_id_activo_idx"
  ON "plantillas_mantenimiento"("tenant_id", "activo");

CREATE INDEX IF NOT EXISTS "plantillas_mantenimiento_tenant_id_tipo_equipo_idx"
  ON "plantillas_mantenimiento"("tenant_id", "tipo_equipo");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plantillas_mantenimiento_tenant_id_fkey'
  ) THEN
    ALTER TABLE "plantillas_mantenimiento"
      ADD CONSTRAINT "plantillas_mantenimiento_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================
-- 2. Tabla plantillas_mantenimiento_items
-- =========================================================
CREATE TABLE IF NOT EXISTS "plantillas_mantenimiento_items" (
  "id"           TEXT NOT NULL,
  "tenant_id"    TEXT NOT NULL,
  "plantilla_id" TEXT NOT NULL,
  "repuesto_id"  TEXT NOT NULL,
  "cantidad"     INTEGER NOT NULL,
  "obligatorio"  BOOLEAN NOT NULL DEFAULT true,
  "observacion"  TEXT,

  CONSTRAINT "plantillas_mantenimiento_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "plantillas_mantenimiento_items_cantidad_positiva"
    CHECK ("cantidad" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "plantillas_mantenimiento_items_tenant_id_plantilla_id_repuesto_id_key"
  ON "plantillas_mantenimiento_items"("tenant_id", "plantilla_id", "repuesto_id");

CREATE INDEX IF NOT EXISTS "plantillas_mantenimiento_items_tenant_id_plantilla_id_idx"
  ON "plantillas_mantenimiento_items"("tenant_id", "plantilla_id");

CREATE INDEX IF NOT EXISTS "plantillas_mantenimiento_items_repuesto_id_idx"
  ON "plantillas_mantenimiento_items"("repuesto_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plantillas_mantenimiento_items_tenant_id_fkey'
  ) THEN
    ALTER TABLE "plantillas_mantenimiento_items"
      ADD CONSTRAINT "plantillas_mantenimiento_items_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plantillas_mantenimiento_items_plantilla_id_fkey'
  ) THEN
    ALTER TABLE "plantillas_mantenimiento_items"
      ADD CONSTRAINT "plantillas_mantenimiento_items_plantilla_id_fkey"
      FOREIGN KEY ("plantilla_id") REFERENCES "plantillas_mantenimiento"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plantillas_mantenimiento_items_repuesto_id_fkey'
  ) THEN
    ALTER TABLE "plantillas_mantenimiento_items"
      ADD CONSTRAINT "plantillas_mantenimiento_items_repuesto_id_fkey"
      FOREIGN KEY ("repuesto_id") REFERENCES "repuestos"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================
-- 3. Tabla equipos_plantillas_mantenimiento
-- =========================================================
CREATE TABLE IF NOT EXISTS "equipos_plantillas_mantenimiento" (
  "id"           TEXT NOT NULL,
  "tenant_id"    TEXT NOT NULL,
  "equipo_id"    TEXT NOT NULL,
  "plantilla_id" TEXT NOT NULL,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "equipos_plantillas_mantenimiento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "equipos_plantillas_mantenimiento_tenant_id_equipo_id_plantilla_id_key"
  ON "equipos_plantillas_mantenimiento"("tenant_id", "equipo_id", "plantilla_id");

CREATE INDEX IF NOT EXISTS "equipos_plantillas_mantenimiento_tenant_id_equipo_id_idx"
  ON "equipos_plantillas_mantenimiento"("tenant_id", "equipo_id");

CREATE INDEX IF NOT EXISTS "equipos_plantillas_mantenimiento_plantilla_id_idx"
  ON "equipos_plantillas_mantenimiento"("plantilla_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'equipos_plantillas_mantenimiento_tenant_id_fkey'
  ) THEN
    ALTER TABLE "equipos_plantillas_mantenimiento"
      ADD CONSTRAINT "equipos_plantillas_mantenimiento_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'equipos_plantillas_mantenimiento_equipo_id_fkey'
  ) THEN
    ALTER TABLE "equipos_plantillas_mantenimiento"
      ADD CONSTRAINT "equipos_plantillas_mantenimiento_equipo_id_fkey"
      FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'equipos_plantillas_mantenimiento_plantilla_id_fkey'
  ) THEN
    ALTER TABLE "equipos_plantillas_mantenimiento"
      ADD CONSTRAINT "equipos_plantillas_mantenimiento_plantilla_id_fkey"
      FOREIGN KEY ("plantilla_id") REFERENCES "plantillas_mantenimiento"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================
-- 4. RLS
-- =========================================================
ALTER TABLE "plantillas_mantenimiento"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plantillas_mantenimiento_items"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipos_plantillas_mantenimiento" ENABLE ROW LEVEL SECURITY;

-- Lectura para el tenant (mechanic consulta la receta); escritura
-- admin/jefe_taller — mismo criterio que equipos_repuestos.
DROP POLICY IF EXISTS "plantillas_mantenimiento_select_tenant" ON "plantillas_mantenimiento";
CREATE POLICY "plantillas_mantenimiento_select_tenant"
  ON "plantillas_mantenimiento" FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id());

DROP POLICY IF EXISTS "plantillas_mantenimiento_write_admin_jefe" ON "plantillas_mantenimiento";
CREATE POLICY "plantillas_mantenimiento_write_admin_jefe"
  ON "plantillas_mantenimiento" FOR ALL TO authenticated
  USING (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  )
  WITH CHECK (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  );

DROP POLICY IF EXISTS "plantillas_mantenimiento_items_select_tenant" ON "plantillas_mantenimiento_items";
CREATE POLICY "plantillas_mantenimiento_items_select_tenant"
  ON "plantillas_mantenimiento_items" FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id());

DROP POLICY IF EXISTS "plantillas_mantenimiento_items_write_admin_jefe" ON "plantillas_mantenimiento_items";
CREATE POLICY "plantillas_mantenimiento_items_write_admin_jefe"
  ON "plantillas_mantenimiento_items" FOR ALL TO authenticated
  USING (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  )
  WITH CHECK (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  );

DROP POLICY IF EXISTS "equipos_plantillas_mantenimiento_select_tenant" ON "equipos_plantillas_mantenimiento";
CREATE POLICY "equipos_plantillas_mantenimiento_select_tenant"
  ON "equipos_plantillas_mantenimiento" FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id());

DROP POLICY IF EXISTS "equipos_plantillas_mantenimiento_write_admin_jefe" ON "equipos_plantillas_mantenimiento";
CREATE POLICY "equipos_plantillas_mantenimiento_write_admin_jefe"
  ON "equipos_plantillas_mantenimiento" FOR ALL TO authenticated
  USING (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  )
  WITH CHECK (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  );
