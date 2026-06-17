import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from './types';

interface ProfileRow {
  id: string;
  role: UserRole;
  tenant_id: string;
  full_name: string | null;
}

interface CacheEntry {
  profile: ProfileRow;
  expiresAt: number;
}

// TTL corto: un cambio de rol/tenant se propaga en a lo sumo 30s. Si se
// necesita propagacion inmediata, llamar invalidate(userId) tras el cambio.
const TTL_MS = 30 * 1000;

@Injectable()
export class ProfileService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async getById(userId: string): Promise<ProfileRow | null> {
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.profile;
    }

    const rows = await this.prisma.$queryRaw<ProfileRow[]>`
      SELECT id, role::text AS role, tenant_id, full_name
      FROM public.profiles
      WHERE id = ${userId}::uuid
      LIMIT 1
    `;

    const profile = rows[0];
    if (!profile) {
      this.cache.delete(userId);
      return null;
    }

    this.cache.set(userId, { profile, expiresAt: Date.now() + TTL_MS });
    return profile;
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * Batch de resúmenes { id, nombre } para hidratar respuestas (tickets,
   * OTs, PDF, reportes). Sin caché: se usa en listados puntuales y el
   * volumen es bajo. Punto único de acceso a profiles para nombres —
   * no duplicar este query en los services.
   */
  async getUserSummaries(
    userIds: string[],
  ): Promise<Map<string, { id: string; nombre: string | null }>> {
    const uniq = Array.from(new Set(userIds)).filter(Boolean);
    if (uniq.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; full_name: string | null }>
    >`
      SELECT id::text AS id, full_name
      FROM public.profiles
      WHERE id = ANY(${uniq}::uuid[])
    `;
    return new Map(rows.map((r) => [r.id, { id: r.id, nombre: r.full_name }]));
  }

  /**
   * ¿El usuario pertenece al tenant? (cualquier rol). Para validar
   * referencias a usuarios (ej. responsable de una programación).
   */
  async existsInTenant(tenantId: string, userId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id::text AS id
      FROM public.profiles
      WHERE id = ${userId}::uuid
        AND tenant_id = ${tenantId}
      LIMIT 1
    `;
    return rows.length > 0;
  }
}
