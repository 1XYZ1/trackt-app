-- TRA-16: RLS + trigger de eventos de estado.
--
-- Objetivos:
--  1. Activar RLS en tablas de negocio.
--  2. Policies por rol (admin / mechanic) y tenant.
--  3. Trigger que registra eventos de cambio de estado de tickets.
--
-- Nota sobre el modelo de acceso:
--  - Backend NestJS conecta como rol `postgres` (superuser) → bypassa RLS.
--    La autorización a nivel API se hace via AuthGuard + RolesGuard.
--  - Cliente Supabase JS del frontend conecta como `authenticated` con JWT →
--    RLS aplica. Esa es la capa de defensa en profundidad.
--  - Cliente Supabase JS `anon` → RLS bloquea todo (no hay policy `to anon`).

-- =========================================================
-- 1. Helpers (security definer para evitar recursion contra profiles)
-- =========================================================

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_tenant_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

grant execute on function public.auth_role() to authenticated;
grant execute on function public.auth_tenant_id() to authenticated;

-- =========================================================
-- 2. RLS — profiles
-- Usuario puede ver SU propio profile. Admin de su tenant puede ver todos los
-- profiles del mismo tenant (para pantalla de admin de usuarios).
-- =========================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_select_admin_same_tenant" on public.profiles;
create policy "profiles_select_admin_same_tenant"
  on public.profiles for select to authenticated
  using (
    public.auth_role() = 'admin'
    and tenant_id = public.auth_tenant_id()
  );

-- =========================================================
-- 3. RLS — equipos
-- admin: full CRUD en su tenant.
-- mechanic: SELECT en su tenant.
-- =========================================================
alter table public.equipos enable row level security;

drop policy if exists "equipos_select_tenant" on public.equipos;
create policy "equipos_select_tenant"
  on public.equipos for select to authenticated
  using (tenant_id = public.auth_tenant_id());

drop policy if exists "equipos_write_admin" on public.equipos;
create policy "equipos_write_admin"
  on public.equipos for all to authenticated
  using (
    public.auth_role() = 'admin'
    and tenant_id = public.auth_tenant_id()
  )
  with check (
    public.auth_role() = 'admin'
    and tenant_id = public.auth_tenant_id()
  );

-- =========================================================
-- 4. RLS — ordenes_trabajo
-- admin: full CRUD en su tenant.
-- mechanic: SELECT en su tenant.
-- =========================================================
alter table public.ordenes_trabajo enable row level security;

drop policy if exists "ordenes_select_tenant" on public.ordenes_trabajo;
create policy "ordenes_select_tenant"
  on public.ordenes_trabajo for select to authenticated
  using (tenant_id = public.auth_tenant_id());

drop policy if exists "ordenes_write_admin" on public.ordenes_trabajo;
create policy "ordenes_write_admin"
  on public.ordenes_trabajo for all to authenticated
  using (
    public.auth_role() = 'admin'
    and tenant_id = public.auth_tenant_id()
  )
  with check (
    public.auth_role() = 'admin'
    and tenant_id = public.auth_tenant_id()
  );

-- =========================================================
-- 5. RLS — tickets
-- admin: full CRUD en su tenant.
-- mechanic: SELECT solo tickets asignados a si mismo (mecanico_id = auth.uid())
--           dentro de su tenant.
-- mechanic: UPDATE solo tickets asignados a si mismo (para cambiar de estado).
-- =========================================================
alter table public.tickets enable row level security;

drop policy if exists "tickets_select_admin" on public.tickets;
create policy "tickets_select_admin"
  on public.tickets for select to authenticated
  using (
    public.auth_role() = 'admin'
    and tenant_id = public.auth_tenant_id()
  );

drop policy if exists "tickets_select_mechanic_own" on public.tickets;
create policy "tickets_select_mechanic_own"
  on public.tickets for select to authenticated
  using (
    public.auth_role() = 'mechanic'
    and tenant_id = public.auth_tenant_id()
    and mecanico_id = auth.uid()::text
  );

drop policy if exists "tickets_write_admin" on public.tickets;
create policy "tickets_write_admin"
  on public.tickets for all to authenticated
  using (
    public.auth_role() = 'admin'
    and tenant_id = public.auth_tenant_id()
  )
  with check (
    public.auth_role() = 'admin'
    and tenant_id = public.auth_tenant_id()
  );

drop policy if exists "tickets_update_mechanic_own" on public.tickets;
create policy "tickets_update_mechanic_own"
  on public.tickets for update to authenticated
  using (
    public.auth_role() = 'mechanic'
    and tenant_id = public.auth_tenant_id()
    and mecanico_id = auth.uid()::text
  )
  with check (
    public.auth_role() = 'mechanic'
    and tenant_id = public.auth_tenant_id()
    and mecanico_id = auth.uid()::text
  );

-- =========================================================
-- 6. RLS — evidencias
-- admin: full CRUD en evidencias del tenant.
-- mechanic: SELECT/INSERT/DELETE solo evidencias de tickets asignados a si mismo.
-- =========================================================
alter table public.evidencias enable row level security;

drop policy if exists "evidencias_select_admin" on public.evidencias;
create policy "evidencias_select_admin"
  on public.evidencias for select to authenticated
  using (
    public.auth_role() = 'admin'
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.tenant_id = public.auth_tenant_id()
    )
  );

drop policy if exists "evidencias_select_mechanic_own" on public.evidencias;
create policy "evidencias_select_mechanic_own"
  on public.evidencias for select to authenticated
  using (
    public.auth_role() = 'mechanic'
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.tenant_id = public.auth_tenant_id()
        and t.mecanico_id = auth.uid()::text
    )
  );

drop policy if exists "evidencias_write_admin" on public.evidencias;
create policy "evidencias_write_admin"
  on public.evidencias for all to authenticated
  using (
    public.auth_role() = 'admin'
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.tenant_id = public.auth_tenant_id()
    )
  )
  with check (
    public.auth_role() = 'admin'
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.tenant_id = public.auth_tenant_id()
    )
  );

drop policy if exists "evidencias_write_mechanic_own" on public.evidencias;
create policy "evidencias_write_mechanic_own"
  on public.evidencias for all to authenticated
  using (
    public.auth_role() = 'mechanic'
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.tenant_id = public.auth_tenant_id()
        and t.mecanico_id = auth.uid()::text
    )
  )
  with check (
    public.auth_role() = 'mechanic'
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.tenant_id = public.auth_tenant_id()
        and t.mecanico_id = auth.uid()::text
    )
  );

-- =========================================================
-- 7. RLS — eventos_estado_ticket
-- admin: SELECT eventos del tenant.
-- mechanic: SELECT eventos de tickets asignados a si mismo.
-- INSERT/UPDATE/DELETE solo via trigger (que corre con security definer del
-- propietario de la función) o via service role del backend.
-- =========================================================
alter table public.eventos_estado_ticket enable row level security;

drop policy if exists "eventos_select_admin" on public.eventos_estado_ticket;
create policy "eventos_select_admin"
  on public.eventos_estado_ticket for select to authenticated
  using (
    public.auth_role() = 'admin'
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.tenant_id = public.auth_tenant_id()
    )
  );

drop policy if exists "eventos_select_mechanic_own" on public.eventos_estado_ticket;
create policy "eventos_select_mechanic_own"
  on public.eventos_estado_ticket for select to authenticated
  using (
    public.auth_role() = 'mechanic'
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.tenant_id = public.auth_tenant_id()
        and t.mecanico_id = auth.uid()::text
    )
  );

-- =========================================================
-- 8. RLS — notificaciones
-- Cada usuario solo ve sus propias notificaciones.
-- =========================================================
alter table public.notificaciones enable row level security;

drop policy if exists "notificaciones_select_own" on public.notificaciones;
create policy "notificaciones_select_own"
  on public.notificaciones for select to authenticated
  using (
    usuario_id = auth.uid()::text
    and tenant_id = public.auth_tenant_id()
  );

drop policy if exists "notificaciones_update_own" on public.notificaciones;
create policy "notificaciones_update_own"
  on public.notificaciones for update to authenticated
  using (
    usuario_id = auth.uid()::text
    and tenant_id = public.auth_tenant_id()
  )
  with check (
    usuario_id = auth.uid()::text
    and tenant_id = public.auth_tenant_id()
  );

-- =========================================================
-- 9. Trigger: registrar evento al cambiar estado de ticket
-- =========================================================

-- Default id como UUID para que el trigger pueda omitir el id manualmente.
-- (El schema Prisma genera cuid() en runtime; aqui generamos uuid si el INSERT
--  viene del trigger, lo cual no rompe el cliente Prisma porque el campo es TEXT.)
alter table public.eventos_estado_ticket
  alter column id set default gen_random_uuid()::text;

create or replace function public.fn_log_ticket_estado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  if old.estado is distinct from new.estado then
    uid := auth.uid();
    -- Solo se registra cuando hay un usuario autenticado detras del UPDATE.
    -- UPDATEs de backend con service role tienen auth.uid() = NULL; el
    -- service de tickets debe escribir el evento explicitamente con el
    -- usuario_id correcto en esos casos.
    if uid is not null then
      insert into public.eventos_estado_ticket
        (ticket_id, estado_anterior, estado_nuevo, usuario_id, created_at)
      values (
        new.id,
        old.estado,
        new.estado,
        uid::text,
        now()
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ticket_estado_change on public.tickets;
create trigger trg_ticket_estado_change
  after update of estado on public.tickets
  for each row
  execute function public.fn_log_ticket_estado();
