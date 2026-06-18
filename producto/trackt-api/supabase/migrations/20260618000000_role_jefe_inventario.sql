-- Agregar rol `jefe_inventario` (Gestor de inventario) al sistema.
-- Espejo de 20260519000000_role_jefe_taller.sql. Idempotente: no rompe roles
-- existentes (admin/mechanic/jefe_taller siguen válidos).
--
-- Permisos (aplicados a nivel API vía @Roles, que usa Prisma y bypassa RLS):
-- CRUD repuestos, entrada/ajuste de stock, aprobar/rechazar reservas, ver
-- movimientos y solicitudes pendientes. No gestiona tickets/órdenes/equipos.

-- =========================================================
-- 1. Enum user_role (si existe) → agregar valor
-- ALTER TYPE ... ADD VALUE con IF NOT EXISTS (PG12+). En PG15 (Supabase) puede
-- correr en transacción siempre que el valor no se use en la misma tx.
-- =========================================================
DO $migration_enum$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    BEGIN
      ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'jefe_inventario';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END
$migration_enum$;

-- =========================================================
-- 2. CHECK constraint (si la columna es TEXT) → recrear con 4 valores
-- =========================================================
DO $migration_check$
DECLARE
  col_type text;
  constraint_name text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'role';

  IF col_type IN ('text', 'character varying') THEN
    SELECT conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'profiles'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%role%admin%mechanic%'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name);
    END IF;

    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('admin', 'mechanic', 'jefe_taller', 'jefe_inventario'));
  END IF;
END
$migration_check$;

-- =========================================================
-- 3. RLS — profiles: jefe_inventario ve profiles del mismo tenant
-- (espejo de la policy de jefe_taller; consistencia para acceso directo)
-- =========================================================
drop policy if exists "profiles_select_jefe_inventario_same_tenant" on public.profiles;
create policy "profiles_select_jefe_inventario_same_tenant"
  on public.profiles for select to authenticated
  using (
    public.auth_role() = 'jefe_inventario'
    and tenant_id = public.auth_tenant_id()
  );
