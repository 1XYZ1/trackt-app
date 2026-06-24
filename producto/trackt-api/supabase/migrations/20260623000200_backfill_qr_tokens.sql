-- TRA: backfill de qr_token en equipos y repuestos existentes.
--
-- Contexto:
--   Ahora el QR se genera por defecto al crear equipos/repuestos. Las filas
--   creadas antes de este cambio tienen qr_token NULL; este backfill les asigna
--   un token estable para que su QR funcione sin acción manual.
--
-- Idempotente: solo afecta filas con qr_token NULL. gen_random_uuid() garantiza
-- unicidad (no colisiona con el índice único).

UPDATE "equipos"
  SET "qr_token" = gen_random_uuid()::text
  WHERE "qr_token" IS NULL;

UPDATE "repuestos"
  SET "qr_token" = gen_random_uuid()::text
  WHERE "qr_token" IS NULL;
