export interface EvidenciaResponseDto {
  id: string;
  ticketId: string;
  storagePath: string;
  descripcion: string | null;
  subidoPorId: string;
  createdAt: string;
  downloadUrl: string | null;
}

export interface UploadSignedUrlResponseDto {
  uploadUrl: string;
  token: string;
  storagePath: string;
  expiresIn: number;
}
