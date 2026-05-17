import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  storagePath!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}
