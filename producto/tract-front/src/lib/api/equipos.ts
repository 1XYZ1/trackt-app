import { authFetch } from "@/lib/api/http";

export type Equipo = {
  id: string;
  codigo: string;
  nombre: string;
  marca: string;
  modelo: string;
  ubicacion: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function getEquipos(): Promise<Equipo[]> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL no esta configurada");
  }

  const response = await authFetch(`${API_BASE_URL}/equipos`);

  if (!response.ok) {
    throw new Error("No se pudieron cargar los equipos");
  }

  return response.json();
}
