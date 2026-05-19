-- TRA: agregar rol `jefe_taller` al sistema.
--
-- Cubre dos posibles estados del esquema:
--  1. profiles.role es enum `user_role` (instalaciones que aplicaron TRA-14 con
--     enum manualmente). En ese caso usamos ALTER TYPE ADD VALUE.
--  2. profiles.role es TEXT con CHECK (creado por la migration idempotente de
--     TRA-17). En ese caso recreamos el CHECK con los 3 valores.
--
-- Idempotente: no rompe usuarios existentes (admin/mechanic siguen siendo
-- valores válidos).

-- =========================================================
-- 1. Enum user_role (si existe) → agregar valor
-- ALTER TYPE ... ADD VALUE no corre dentro de un bloque transaccional, por lo
-- que lo aplicamos vía sentencia top-level con IF NOT EXISTS (PG12+).
-- =========================================================
DO $migration_enum$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    BEGIN
      ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'jefe_taller';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END
$migration_enum$;

-- =========================================================
-- 2. CHECK constraint (si la columna es TEXT) → recrear con 3 valores
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
    -- Buscar el check constraint actual y reemplazarlo.
    -- LIMIT 1 evita comportamiento PG-dependiente si >1 constraint matchea.
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

    -- Recrear con jefe_taller incluido.
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('admin', 'mechanic', 'jefe_taller'));
  END IF;
END
$migration_check$;

-- =========================================================
-- 3. RLS — profiles: jefe_taller ve profiles del mismo tenant (igual que admin)
-- =========================================================
drop policy if exists "profiles_select_jefe_taller_same_tenant" on public.profiles;
create policy "profiles_select_jefe_taller_same_tenant"
  on public.profiles for select to authenticated
  using (
    public.auth_role() = 'jefe_taller'
    and tenant_id = public.auth_tenant_id()
  );

-- =========================================================
-- 4. RLS — equipos: jefe_taller solo lectura (no escribe)
-- (El select policy ya cubre a todos los authenticated del tenant; no se
-- agrega write policy para jefe_taller — el scope de esta tarea no abre
-- escritura de equipos a jefe_taller.)
-- =========================================================
-- NOTA: equipos_select_tenant ya permite SELECT a cualquier usuario del
-- tenant, así que jefe_taller queda cubierto sin policy adicional.

-- =========================================================
-- 5. RLS — tickets: jefe_taller ve todos y puede escribir (asignar/reasignar)
-- =========================================================
drop policy if exists "tickets_select_jefe_taller" on public.tickets;
create policy "tickets_select_jefe_taller"
  on public.tickets for select to authenticated
  using (
    public.auth_role() = 'jefe_taller'
    and tenant_id = public.auth_tenant_id()
  );

drop policy if exists "tickets_write_jefe_taller" on public.tickets;
create policy "tickets_write_jefe_taller"
  on public.tickets for all to authenticated
  using (
    public.auth_role() = 'jefe_taller'
    and tenant_id = public.auth_tenant_id()
  )
  with check (
    public.auth_role() = 'jefe_taller'
    and tenant_id = public.auth_tenant_id()
  );

-- =========================================================
-- 6. RLS — evidencias: jefe_taller puede ver todas las del tenant
-- =========================================================
drop policy if exists "evidencias_select_jefe_taller" on public.evidencias;
create policy "evidencias_select_jefe_taller"
  on public.evidencias for select to authenticated
  using (
    public.auth_role() = 'jefe_taller'
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.tenant_id = public.auth_tenant_id()
    )
  );

-- =========================================================
-- 7. RLS — eventos_estado_ticket: jefe_taller ve eventos del tenant
-- =========================================================
drop policy if exists "eventos_select_jefe_taller" on public.eventos_estado_ticket;
create policy "eventos_select_jefe_taller"
  on public.eventos_estado_ticket for select to authenticated
  using (
    public.auth_role() = 'jefe_taller'
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.tenant_id = public.auth_tenant_id()
    )
  );
