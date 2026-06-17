-- Backfill: normaliza códigos legacy de equipos a UPPER(TRIM(codigo)) para
-- alinear la BD con la normalización del service (Fase 1). Sin esto, un
-- equipo legacy "eq-100" convive con "EQ-100" creado post-normalización:
-- el dup-check del service busca el código normalizado y la unique
-- (tenant_id, codigo) es case-sensitive, así que ninguno lo detecta.
--
-- Aborta a propósito si la normalización produciría colisiones con la
-- unique (tenant_id, codigo): mejor fallar y resolver los duplicados a
-- mano que fusionar equipos silenciosamente.
--
-- Idempotente: el UPDATE solo toca filas cuyo código aún no está
-- normalizado; en una segunda ejecución no hay filas que actualizar.
DO $$
DECLARE
  colisiones INT;
BEGIN
  SELECT COUNT(*) INTO colisiones FROM (
    SELECT tenant_id, UPPER(TRIM(codigo)) AS codigo_norm
    FROM equipos
    GROUP BY tenant_id, UPPER(TRIM(codigo))
    HAVING COUNT(*) > 1
  ) t;

  IF colisiones > 0 THEN
    RAISE EXCEPTION 'equipos: % grupo(s) de códigos colisionan al normalizar con UPPER(TRIM()). Resolver los duplicados manualmente antes de aplicar esta migración.', colisiones;
  END IF;

  UPDATE equipos
  SET codigo = UPPER(TRIM(codigo))
  WHERE codigo <> UPPER(TRIM(codigo));
END $$;
