// Serialización CSV mínima y sin dependencias (RFC 4180):
// - separador coma, EOL CRLF (Excel-friendly)
// - escapa comillas, comas y saltos de línea con comillas dobles
// - BOM UTF-8 para que Excel detecte tildes/eñes
const BOM = '\uFEFF';

export function toCsv(
  headers: string[],
  rows: Record<string, unknown>[],
): string {
  const stringify = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    if (value instanceof Date) return value.toISOString();
    // Objetos/arrays → JSON (symbol/function no aparecen en filas de reporte).
    return JSON.stringify(value) ?? '';
  };
  const escape = (value: unknown): string => {
    const s = stringify(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return BOM + lines.join('\r\n');
}
