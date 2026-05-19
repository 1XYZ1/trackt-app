-- TRA: Inventario MVP — repuestos, stock, reservas, movimientos.
--
-- Modelo:
--   repuestos                 — catálogo del taller (multi-tenant, baja lógica).
--   inventario_stock          — stock 1:1 con repuesto (stockActual / stockReservado).
--   reservas_repuestos        — reserva de repuestos para un ticket.
--   reserva_repuesto_items    — items de una reserva (n por reserva).
--   movimientos_inventario    — historial inmutable. Cada cambio de stock o
--                               stockReservado emite un movimiento.
--
-- Reglas de seguridad:
--   - Multi-tenant: todas las tablas con tenant_id + index.
--   - RLS habilitado: admin/jefe_taller acceso total al tenant; mechanic solo
--     lectura del catálogo activo y reservas de sus tickets asignados.
--   - El backend (service role) bypassa RLS — el refuerzo de scoping vive en
--     InventarioService.

-- =========================================================
-- 1. Enums
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MovimientoInventarioTipo') THEN
    CREATE TYPE "MovimientoInventarioTipo" AS ENUM (
      'ENTRADA', 'SALIDA', 'AJUSTE', 'RESERVA', 'LIBERACION', 'CONSUMO'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReservaRepuestoEstado') THEN
    CREATE TYPE "ReservaRepuestoEstado" AS ENUM (
      'SOLICITADA', 'RESERVADA', 'CONSUMIDA', 'LIBERADA', 'CANCELADA'
    );
  END IF;
END $$;

-- =========================================================
-- 2. Tabla repuestos
-- =========================================================
CREATE TABLE IF NOT EXISTS "repuestos" (
  "id"           TEXT NOT NULL,
  "tenant_id"    TEXT NOT NULL,
  "codigo"       TEXT NOT NULL,
  "nombre"       TEXT NOT NULL,
  "descripcion"  TEXT,
  "categoria"    TEXT,
  "unidad"       TEXT NOT NULL DEFAULT 'unidad',
  "stock_minimo" INTEGER NOT NULL DEFAULT 0,
  "activo"       BOOLEAN NOT NULL DEFAULT true,
  "metadata"     JSONB,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "repuestos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "repuestos_tenant_id_codigo_key"
  ON "repuestos"("tenant_id", "codigo");

CREATE INDEX IF NOT EXISTS "repuestos_tenant_id_activo_idx"
  ON "repuestos"("tenant_id", "activo");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'repuestos_tenant_id_fkey'
  ) THEN
    ALTER TABLE "repuestos"
      ADD CONSTRAINT "repuestos_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================
-- 3. Tabla inventario_stock
-- =========================================================
CREATE TABLE IF NOT EXISTS "inventario_stock" (
  "id"              TEXT NOT NULL,
  "tenant_id"       TEXT NOT NULL,
  "repuesto_id"     TEXT NOT NULL,
  "stock_actual"    INTEGER NOT NULL DEFAULT 0,
  "stock_reservado" INTEGER NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inventario_stock_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "inventario_stock_repuesto_uniq" UNIQUE      ("repuesto_id"),
  CONSTRAINT "inventario_stock_no_negativo"   CHECK (stock_actual >= 0 AND stock_reservado >= 0),
  CONSTRAINT "inventario_stock_reserva_le_actual" CHECK (stock_reservado <= stock_actual)
);

CREATE INDEX IF NOT EXISTS "inventario_stock_tenant_id_idx"
  ON "inventario_stock"("tenant_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventario_stock_repuesto_id_fkey'
  ) THEN
    ALTER TABLE "inventario_stock"
      ADD CONSTRAINT "inventario_stock_repuesto_id_fkey"
      FOREIGN KEY ("repuesto_id") REFERENCES "repuestos"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================
-- 4. Tabla reservas_repuestos
-- =========================================================
CREATE TABLE IF NOT EXISTS "reservas_repuestos" (
  "id"               TEXT NOT NULL,
  "tenant_id"        TEXT NOT NULL,
  "ticket_id"        TEXT NOT NULL,
  "estado"           "ReservaRepuestoEstado" NOT NULL DEFAULT 'RESERVADA',
  "creado_por_id"    TEXT NOT NULL,
  "aprobado_por_id"  TEXT,
  "observacion"      TEXT,
  "metadata"         JSONB,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "reservas_repuestos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reservas_repuestos_tenant_ticket_idx"
  ON "reservas_repuestos"("tenant_id", "ticket_id");

CREATE INDEX IF NOT EXISTS "reservas_repuestos_tenant_estado_idx"
  ON "reservas_repuestos"("tenant_id", "estado");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservas_repuestos_tenant_id_fkey'
  ) THEN
    ALTER TABLE "reservas_repuestos"
      ADD CONSTRAINT "reservas_repuestos_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservas_repuestos_ticket_id_fkey'
  ) THEN
    ALTER TABLE "reservas_repuestos"
      ADD CONSTRAINT "reservas_repuestos_ticket_id_fkey"
      FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================
-- 5. Tabla reserva_repuesto_items
-- =========================================================
CREATE TABLE IF NOT EXISTS "reserva_repuesto_items" (
  "id"           TEXT NOT NULL,
  "reserva_id"   TEXT NOT NULL,
  "repuesto_id"  TEXT NOT NULL,
  "cantidad"     INTEGER NOT NULL,

  CONSTRAINT "reserva_repuesto_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reserva_repuesto_items_cantidad_positiva" CHECK (cantidad > 0)
);

CREATE INDEX IF NOT EXISTS "reserva_repuesto_items_reserva_idx"
  ON "reserva_repuesto_items"("reserva_id");

CREATE INDEX IF NOT EXISTS "reserva_repuesto_items_repuesto_idx"
  ON "reserva_repuesto_items"("repuesto_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reserva_repuesto_items_reserva_id_fkey'
  ) THEN
    ALTER TABLE "reserva_repuesto_items"
      ADD CONSTRAINT "reserva_repuesto_items_reserva_id_fkey"
      FOREIGN KEY ("reserva_id") REFERENCES "reservas_repuestos"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reserva_repuesto_items_repuesto_id_fkey'
  ) THEN
    ALTER TABLE "reserva_repuesto_items"
      ADD CONSTRAINT "reserva_repuesto_items_repuesto_id_fkey"
      FOREIGN KEY ("repuesto_id") REFERENCES "repuestos"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================
-- 6. Tabla movimientos_inventario
-- =========================================================
CREATE TABLE IF NOT EXISTS "movimientos_inventario" (
  "id"               TEXT NOT NULL,
  "tenant_id"        TEXT NOT NULL,
  "repuesto_id"      TEXT NOT NULL,
  "tipo"             "MovimientoInventarioTipo" NOT NULL,
  "cantidad"         INTEGER NOT NULL,
  "stock_resultante" INTEGER NOT NULL,
  "usuario_id"       TEXT NOT NULL,
  "ticket_id"        TEXT,
  "reserva_id"       TEXT,
  "observacion"      TEXT,
  "metadata"         JSONB,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "movimientos_inventario_tenant_repuesto_created_idx"
  ON "movimientos_inventario"("tenant_id", "repuesto_id", "created_at");

CREATE INDEX IF NOT EXISTS "movimientos_inventario_reserva_idx"
  ON "movimientos_inventario"("reserva_id");

CREATE INDEX IF NOT EXISTS "movimientos_inventario_ticket_idx"
  ON "movimientos_inventario"("ticket_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_inventario_tenant_id_fkey'
  ) THEN
    ALTER TABLE "movimientos_inventario"
      ADD CONSTRAINT "movimientos_inventario_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_inventario_repuesto_id_fkey'
  ) THEN
    ALTER TABLE "movimientos_inventario"
      ADD CONSTRAINT "movimientos_inventario_repuesto_id_fkey"
      FOREIGN KEY ("repuesto_id") REFERENCES "repuestos"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_inventario_ticket_id_fkey'
  ) THEN
    ALTER TABLE "movimientos_inventario"
      ADD CONSTRAINT "movimientos_inventario_ticket_id_fkey"
      FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_inventario_reserva_id_fkey'
  ) THEN
    ALTER TABLE "movimientos_inventario"
      ADD CONSTRAINT "movimientos_inventario_reserva_id_fkey"
      FOREIGN KEY ("reserva_id") REFERENCES "reservas_repuestos"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================
-- 7. RLS — Row Level Security
-- =========================================================
ALTER TABLE "repuestos"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventario_stock"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservas_repuestos"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reserva_repuesto_items"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "movimientos_inventario"  ENABLE ROW LEVEL SECURITY;

-- repuestos: cualquier rol del tenant lee; admin escribe.
DROP POLICY IF EXISTS "repuestos_select_tenant" ON "repuestos";
CREATE POLICY "repuestos_select_tenant"
  ON "repuestos" FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id());

DROP POLICY IF EXISTS "repuestos_write_admin" ON "repuestos";
CREATE POLICY "repuestos_write_admin"
  ON "repuestos" FOR ALL TO authenticated
  USING (
    public.auth_role() = 'admin'
    AND tenant_id = public.auth_tenant_id()
  )
  WITH CHECK (
    public.auth_role() = 'admin'
    AND tenant_id = public.auth_tenant_id()
  );

-- inventario_stock: lectura para todo el tenant; escritura solo admin
-- (backend con service role bypassa RLS para escrituras vía reservas).
DROP POLICY IF EXISTS "inventario_stock_select_tenant" ON "inventario_stock";
CREATE POLICY "inventario_stock_select_tenant"
  ON "inventario_stock" FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id());

DROP POLICY IF EXISTS "inventario_stock_write_admin" ON "inventario_stock";
CREATE POLICY "inventario_stock_write_admin"
  ON "inventario_stock" FOR ALL TO authenticated
  USING (
    public.auth_role() = 'admin'
    AND tenant_id = public.auth_tenant_id()
  )
  WITH CHECK (
    public.auth_role() = 'admin'
    AND tenant_id = public.auth_tenant_id()
  );

-- reservas_repuestos:
--   admin / jefe_taller: ven todas las del tenant.
--   mechanic: solo reservas de sus tickets.
DROP POLICY IF EXISTS "reservas_select_admin_jefe" ON "reservas_repuestos";
CREATE POLICY "reservas_select_admin_jefe"
  ON "reservas_repuestos" FOR SELECT TO authenticated
  USING (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  );

DROP POLICY IF EXISTS "reservas_select_mechanic_own" ON "reservas_repuestos";
CREATE POLICY "reservas_select_mechanic_own"
  ON "reservas_repuestos" FOR SELECT TO authenticated
  USING (
    public.auth_role() = 'mechanic'
    AND tenant_id = public.auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND t.mecanico_id = auth.uid()::text
    )
  );

-- reserva_repuesto_items: lectura sigue las policies de la reserva padre.
DROP POLICY IF EXISTS "reserva_items_select_tenant" ON "reserva_repuesto_items";
CREATE POLICY "reserva_items_select_tenant"
  ON "reserva_repuesto_items" FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reservas_repuestos r
      WHERE r.id = reserva_id
        AND r.tenant_id = public.auth_tenant_id()
    )
  );

-- movimientos_inventario: admin / jefe_taller del tenant.
DROP POLICY IF EXISTS "movimientos_select_admin_jefe" ON "movimientos_inventario";
CREATE POLICY "movimientos_select_admin_jefe"
  ON "movimientos_inventario" FOR SELECT TO authenticated
  USING (
    public.auth_role() IN ('admin', 'jefe_taller')
    AND tenant_id = public.auth_tenant_id()
  );
