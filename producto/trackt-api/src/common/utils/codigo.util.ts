/**
 * Siguiente código secuencial PREFIJO-NNNN (zero-padded a 4).
 * `ultimoCodigo` es el mayor código existente que matchea el prefijo
 * (o null si no hay); códigos legados que no parsean se ignoran.
 *
 * El caller es responsable de la concurrencia: calcular el último código y
 * crear el registro dentro de una transacción con advisory lock (patrón de
 * OrdenesService/TicketsService.crearEnTx).
 *
 * LIMITACIÓN: el ordenamiento lexicográfico del caller funciona hasta 9999
 * registros/año (el padStart mantiene ancho fijo). Si un tenant supera ese
 * volumen anual, migrar la búsqueda del último código a parse numérico.
 */
export function siguienteCodigo(
  prefix: string,
  ultimoCodigo: string | null | undefined,
): string {
  let nextSeq = 1;
  if (ultimoCodigo) {
    const parsed = parseInt(ultimoCodigo.slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}
