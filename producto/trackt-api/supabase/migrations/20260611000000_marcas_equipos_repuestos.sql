-- TRA: Fase 2 — catálogo de marcas, ficha de repuesto y repuestos por equipo.
--
-- Modelo:
--   marcas             — catálogo maestro por tenant (ámbito EQUIPO/REPUESTO/AMBOS).
--   repuestos          — gana marca_id (FK a marcas), codigo_fabricante,
--                        ubicacion_bodega y proveedor.
--   equipos_repuestos  — repuestos/insumos habituales de cada equipo
--                        (base de plantillas de mantenimiento, Fase 3+).
--
-- Compatibilidad:
--   - equipos.marca (texto libre) se mantiene; la migración a marca_id será
--     progresiva cuando el frontend consuma el catálogo.
--   - Ninguna columna existente cambia ni se elimina.
--
-- Reglas de seguridad:
--   - Multi-tenant: tablas nuevas con tenant_id + index.
--   - RLS habilitado siguiendo el patrón de inventario: lectura para el
--     tenant autenticado; escritura admin. El backend (service role)
--     bypassa RLS — el scoping se refuerza en los services.

-- =========================================================
-- 1. Enum MarcaTipo
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MarcaTipo') THEN
    CREATE TYPE "MarcaTipo" AS ENUM ('EQUIPO', 'REPUESTO', 'AMBOS');
  END IF;
END $$;

-- =========================================================
-- 2. Tabla marcas
-- =========================================================
CREATE TABLE IF NOT EXISTS "marcas" (
  "id"         TEXT NOT NULL,
  "tenant_id"  TEXT NOT NULL,
  "nombre"     TEXT NOT NULL,
  "tipo"       "MarcaTipo" NOT NULL,
  "activo"     BOOLEAN NOT NULL DEFAULT true,
  "metadata"   JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "marcas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "marcas_tenant_id_nombre_tipo_key"
  ON "marcas"("tenant_id", "nombre", "tipo");

CREATE INDEX IF NOT EXISTS "marcas_tenant_id_activo_idx"
  ON "marcas"("tenant_id", "activo");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marcas_tenant_id_fkey'
  ) THEN
    ALTER TABLE "marcas"
      ADD CONSTRAINT "marcas_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================
-- 3. Repuestos: ficha extendida
-- =========================================================
ALTER TABLE "repuestos"
  ADD COLUMN IF NOT EXISTS "marca_id"          TEXT,
  ADD COLUMN IF NOT EXISTS "codigo_fabricante" TEXT,
  ADD COLUMN IF NOT EXISTS "ubicacion_bodega"  TEXT,
  ADD COLUMN IF NOT EXISTS "proveedor"         TEXT;

CREATE INDEX IF NOT EXISTS "repuestos_marca_id_idx"
  ON "repuestos"("marca_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'repuestos_marca_id_fkey'
  ) THEN
    ALTER TABLE "repuestos"
      ADD CONSTRAINT "repuestos_marca_id_fkey"
      FOREIGN KEY ("marca_id") REFERENCES "marcas"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================
-- 4. Tabla equipos_repuestos
-- =========================================================
CREATE TABLE IF NOT EXISTS "equipos_repuestos" (
  "id"           TEXT NOT NULL,
  "tenant_id"    TEXT NOT NULL,
  "equipo_id"    TEXT NOT NULL,
  "repuesto_id"  TEXT NOT NULL,
  "cantidad_ref" INTEGER,
  "observacion"  TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "equipos_repuestos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "equipos_repuestos_cantidad_ref_positiva"
    CHECK ("cantidad_ref" IS NULL OR "cantidad_ref" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "equipos_repuestos_tenant_id_equipo_id_repuesto_id_key"
  ON "equipos_repuestos"("tenant_id", "equipo_id", "repuesto_id");

CREATE INDEX IF NOT EXISTS "equipos_repuestos_tenant_id_equipo_id_idx"
  ON "equipos_repuestos"("tenant_id", "equipo_id");

CREATE INDEX IF NOT EXISTS "equipos_repuestos_repuesto_id_idx"
  ON "equipos_repuestos"("repuesto_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'equipos_repuestos_tenant_id_fkey'
  ) THEN
    ALTER TABLE "equipos_repuestos"
      ADD CONSTRAINT "equipos_repuestos_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'equipos_repuestos_equipo_id_fkey'
  ) THEN
    ALTER TABLE "equipos_repuestos"
      ADD CONSTRAINT "equipos_repuestos_equipo_id_fkey"
      FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'equipos_repuestos_repuesto_id_fkey'
  ) THEN
    ALTER TABLE "equipos_repuestos"
      ADD CONSTRAINT "equipos_repuestos_repuesto_id_fkey"
      FOREIGN KEY ("repuesto_id") REFERENCES "repuestos"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================
-- 5. RLS
-- =========================================================
ALTER TABLE "marcas"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipos_repuestos" ENABLE ROW LEVEL SECURITY;

-- marcas: cualquier rol del tenant lee (formularios); admin escribe.
DROP POLICY IF EXISTS "marcas_select_tenant" ON "marcas";
CREATE POLICY "marcas_select_tenant"
  ON "marcas" FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id());

DROP POLICY IF EXISTS "marcas_write_admin" ON "marcas";
CREATE POLICY "marcas_write_admin"
  ON "marcas" FOR ALL TO authenticated
  USING (
    public.auth_role() = 'admin'
    AND tenant_id = public.auth_tenant_id()
  )
  WITH CHECK (
    public.auth_role() = 'admin'
    AND tenant_id = public.auth_tenant_id()
  );

-- equipos_repuestos: lectura para el tenant; escritura admin/jefe_taller.
DROP POLICY IF EXISTS "equipos_repuestos_select_tenant" ON "equipos_repuestos";
CREATE POLICY "equipos_repuestos_select_tenant"
  ON "equipos_repuestos" FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id());

DROP POLICY IF EXISTS "equipos_repuestos_write_admin_jefe" ON "equipos_repuestos";
CREATE POLICY "equipos_repuestos_write_admin_jefe"
  ON "equipos_repuestos" FOR ALL TO authenticated
  USING (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  )
  WITH CHECK (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  );
