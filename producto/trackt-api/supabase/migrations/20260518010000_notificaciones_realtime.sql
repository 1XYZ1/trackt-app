-- TRA-28: activar Supabase Realtime sobre tabla notificaciones.
--
-- 1. REPLICA IDENTITY FULL: incluye toda la fila en el evento WAL para que
--    el cliente reciba el payload completo (no solo el PK) en INSERT/UPDATE.
-- 2. Agregar tabla a la publication "supabase_realtime" (idempotente).
--
-- Suscripción cliente filtra por usuario_id; la policy RLS
-- "notificaciones_select_own" (TRA-16) actúa como segundo filtro.

alter table public.notificaciones replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notificaciones'
  ) then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
end $$;
