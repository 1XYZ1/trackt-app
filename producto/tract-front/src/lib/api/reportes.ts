import { authFetch } from "@/lib/api/http";

export type ReporteFiltros = {
  desde?: string;
  hasta?: string;
  estado?: string;
  vista?: string;
  soloCriticos?: boolean;
  equipoId?: string;
  mecanicoId?: string;
};

// Fila genérica: cada reporte trae columnas distintas. La UI las deriva de las keys.
export type ReporteFila = Record<string, string | number | boolean | null>;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

function assertApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL no esta configurada");
  }
}

function buildParams(filtros: ReporteFiltros, formato: "json" | "csv") {
  const params = new URLSearchParams();
  params.set("formato", formato);
  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  if (filtros.estado) params.set("estado", filtros.estado);
  if (filtros.vista) params.set("vista", filtros.vista);
  if (filtros.soloCriticos) params.set("soloCriticos", "true");
  if (filtros.equipoId) params.set("equipoId", filtros.equipoId);
  if (filtros.mecanicoId) params.set("mecanicoId", filtros.mecanicoId);
  return params;
}

// Reportes tabulares en JSON: { data: rows[], total }.
export async function getReporteJson(
  path: string,
  filtros: ReporteFiltros = {},
): Promise<{ data: ReporteFila[]; total: number }> {
  assertApiBaseUrl();

  const params = buildParams(filtros, "json");
  const response = await authFetch(`${API_BASE_URL}${path}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("No se pudo cargar el reporte");
  }
  return (await response.json()) as { data: ReporteFila[]; total: number };
}

// Descarga CSV: lee blob (NO json) y dispara la descarga en el navegador.
export async function descargarReporteCsv(
  path: string,
  filtros: ReporteFiltros,
  filename: string,
): Promise<void> {
  assertApiBaseUrl();

  const params = buildParams(filtros, "csv");
  const response = await authFetch(`${API_BASE_URL}${path}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("No se pudo descargar el CSV");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Historial de un equipo en CSV (timeline aplanada).
export function descargarHistorialEquipoCsv(
  equipoId: string,
  codigo: string,
  filtros: ReporteFiltros = {},
): Promise<void> {
  return descargarReporteCsv(
    `/reportes/equipos/${equipoId}/historial`,
    filtros,
    `historial-${codigo}.csv`,
  );
}
