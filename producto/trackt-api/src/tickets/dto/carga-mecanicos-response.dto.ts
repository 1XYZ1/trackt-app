export interface CargaMecanicoDto {
  mecanicoId: string;
  nombre: string | null;
  email: string | null;
  pendientes: number;
  asignados: number;
  enEjecucion: number;
  ejecutados: number;
  totalAbiertos: number;
}
