import { IsIn, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedMime = (typeof ALLOWED_MIME)[number];

export const MAX_BYTES = 5 * 1024 * 1024;

export class RequestUploadDto {
  @IsString()
  @IsNotEmpty()
  @IsIn([...ALLOWED_MIME])
  mime!: AllowedMime;

  @IsInt()
  @Min(1)
  @Max(MAX_BYTES)
  size!: number;
}
