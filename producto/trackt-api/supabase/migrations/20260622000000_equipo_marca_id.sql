-- TRA: equipos.marca_id — Equipo referencia el catálogo de marcas (FK).
--
-- Modelo:
--   equipos gana marca_id (FK a marcas, ON DELETE SET NULL), espejando lo que
--   ya tienen los repuestos (migración 20260611000000_marcas_equipos_repuestos).
--
-- Compatibilidad:
--   - equipos.marca (texto libre) se conserva como legacy no-destructivo; la
--     fuente de verdad pasa a ser marca_id. Ninguna columna existente cambia.
--   - El seed enlaza los equipos demo (marca texto → marca del catálogo).
--
-- RLS: equipos ya tiene políticas; agregar una columna no las altera.

ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "marca_id" TEXT;

CREATE INDEX IF NOT EXISTS "equipos_marca_id_idx"
  ON "equipos"("marca_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'equipos_marca_id_fkey'
  ) THEN
    ALTER TABLE "equipos"
      ADD CONSTRAINT "equipos_marca_id_fkey"
      FOREIGN KEY ("marca_id") REFERENCES "marcas"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
