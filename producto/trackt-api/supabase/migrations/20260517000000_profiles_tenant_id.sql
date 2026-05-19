-- TRA-17: tabla public.profiles + tenant_id (idempotente)
--
-- Esta migration cubre dos casos:
--   1. profiles no existe (TRA-14 no aplicó migration de schema) -> CREATE TABLE.
--   2. profiles existe sin tenant_id (TRA-14 la creó manual) -> ADD COLUMN.

-- CreateTable (no-op si ya existe)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'mechanic')),
  tenant_id  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AddColumn (no-op si ya existe en tabla creada por TRA-14)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- AddForeignKey (idempotente vía pg_constraint check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS profiles_tenant_id_idx ON public.profiles(tenant_id);
