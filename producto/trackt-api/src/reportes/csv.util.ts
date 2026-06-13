// Serialización CSV mínima y sin dependencias (RFC 4180):
// - separador coma, EOL CRLF (Excel-friendly)
// - escapa comillas, comas y saltos de línea con comillas dobles
// - BOM UTF-8 para que Excel detecte tildes/eñes
const BOM = '\uFEFF';

export function toCsv(
  headers: string[],
  rows: Record<string, unknown>[],
): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const s =
      value instanceof Date
        ? value.toISOString()
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return BOM + lines.join('\r\n');
}
