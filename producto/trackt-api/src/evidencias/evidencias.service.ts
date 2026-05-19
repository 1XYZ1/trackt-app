import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase.service';
import { AuthUser } from '../auth/types';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import {
  ALLOWED_MIME,
  AllowedMime,
  MAX_BYTES,
  RequestUploadDto,
} from './dto/request-upload.dto';
import {
  EvidenciaResponseDto,
  UploadSignedUrlResponseDto,
} from './dto/evidencia-response.dto';

const BUCKET = 'evidencias';
const UPLOAD_TTL_SECONDS = 60;
const DOWNLOAD_TTL_SECONDS = 5 * 60;

const MIME_TO_EXT: Record<AllowedMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class EvidenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async requestUploadUrl(
    tenantId: string,
    user: AuthUser,
    ticketId: string,
    dto: RequestUploadDto,
  ): Promise<UploadSignedUrlResponseDto> {
    if (dto.size > MAX_BYTES) {
      throw new PayloadTooLargeException(
        `Tamaño excede el máximo permitido (${MAX_BYTES} bytes)`,
      );
    }
    if (!ALLOWED_MIME.includes(dto.mime)) {
      throw new ForbiddenException('MIME type no permitido');
    }

    await this.ensureTicketAccess(tenantId, user, ticketId);

    const ext = MIME_TO_EXT[dto.mime];
    const storagePath = `${tenantId}/${ticketId}/${randomUUID()}.${ext}`;

    const admin = this.supabase.getAdminClient();
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      throw new Error(
        `No se pudo generar signed URL: ${error?.message ?? 'desconocido'}`,
      );
    }

    return {
      uploadUrl: data.signedUrl,
      token: data.token,
      storagePath,
      expiresIn: UPLOAD_TTL_SECONDS,
    };
  }

  async confirmUpload(
    tenantId: string,
    user: AuthUser,
    ticketId: string,
    dto: ConfirmUploadDto,
  ): Promise<EvidenciaResponseDto> {
    await this.ensureTicketAccess(tenantId, user, ticketId);

    if (!dto.storagePath.startsWith(`${tenantId}/${ticketId}/`)) {
      throw new ForbiddenException(
        'storagePath no coincide con tenant/ticket actual',
      );
    }

    const admin = this.supabase.getAdminClient();
    const { data: head, error: headError } = await admin.storage
      .from(BUCKET)
      .list(`${tenantId}/${ticketId}`, {
        search: dto.storagePath.split('/').pop() ?? '',
      });
    if (headError || !head || head.length === 0) {
      throw new NotFoundException(
        'Archivo no encontrado en storage; subida no completada',
      );
    }

    const row = await this.prisma.evidencia.create({
      data: {
        ticketId,
        storagePath: dto.storagePath,
        descripcion: dto.descripcion ?? null,
        subidoPorId: user.id,
      },
    });

    return {
      id: row.id,
      ticketId: row.ticketId,
      storagePath: row.storagePath,
      descripcion: row.descripcion,
      subidoPorId: row.subidoPorId,
      createdAt: row.createdAt.toISOString(),
      downloadUrl: await this.signDownload(row.storagePath),
    };
  }

  async listForTicket(
    tenantId: string,
    user: AuthUser,
    ticketId: string,
  ): Promise<EvidenciaResponseDto[]> {
    await this.ensureTicketAccess(tenantId, user, ticketId);

    const rows = await this.prisma.evidencia.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        ticketId: row.ticketId,
        storagePath: row.storagePath,
        descripcion: row.descripcion,
        subidoPorId: row.subidoPorId,
        createdAt: row.createdAt.toISOString(),
        downloadUrl: await this.signDownload(row.storagePath),
      })),
    );
  }

  // ---------- Helpers ----------

  /**
   * Valida que el ticket pertenezca al tenant y que el usuario tenga acceso:
   * - admin: siempre puede sobre tickets del tenant
   * - mechanic: solo si está asignado al ticket
   */
  private async ensureTicketAccess(
    tenantId: string,
    user: AuthUser,
    ticketId: string,
  ): Promise<void> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: { id: true, mecanicoId: true },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket "${ticketId}" no encontrado`);
    }

    // admin y jefe_taller tienen acceso total a evidencias del tenant.
    // mechanic solo si es el asignado al ticket.
    if (user.role === 'admin' || user.role === 'jefe_taller') return;
    if (user.role === 'mechanic' && ticket.mecanicoId === user.id) return;

    throw new ForbiddenException('Sin acceso a evidencias de este ticket');
  }

  private async signDownload(storagePath: string): Promise<string | null> {
    const admin = this.supabase.getAdminClient();
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, DOWNLOAD_TTL_SECONDS);
    if (error || !data) return null;
    return data.signedUrl;
  }
}
