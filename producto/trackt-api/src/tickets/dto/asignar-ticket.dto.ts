import { IsUUID } from 'class-validator';

export class AsignarTicketDto {
  // El id de profiles es un UUID (proviene de auth.users de Supabase) y el
  // service lo castea a ::uuid. Validar el formato evita un 500 por cast fallido.
  @IsUUID()
  mecanicoId!: string;
}
