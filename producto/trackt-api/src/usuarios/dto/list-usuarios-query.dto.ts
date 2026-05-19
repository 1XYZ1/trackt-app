import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListUsuariosQueryDto extends PaginationQueryDto {
  /**
   * Filtro por rol. Valores aceptados:
   *   - "mecanico"  → mapeado internamente a "mechanic"
   *   - "mechanic"  → aceptado directamente
   *   - "admin"     → aceptado directamente
   */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  rol?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

/**
 * Normaliza el parámetro `rol` del query al valor interno de la BD.
 * Soporta español ("mecanico", "jefe") y el valor interno ("mechanic", "jefe_taller").
 */
export function normalizeRol(rol?: string): string | undefined {
  if (!rol) return undefined;
  const lower = rol.toLowerCase();
  if (lower === 'mecanico' || lower === 'mechanic') return 'mechanic';
  if (lower === 'admin') return 'admin';
  if (lower === 'jefe' || lower === 'jefe_taller' || lower === 'jefe-taller') {
    return 'jefe_taller';
  }
  return lower; // pasar cualquier otro rol sin transformar (extensible)
}
