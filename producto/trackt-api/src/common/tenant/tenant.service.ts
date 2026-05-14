/**
 * TenantService
 * =============
 * Responsabilidad: resolver el tenantId del usuario autenticado.
 *
 * ESTADO ACTUAL (TRA-18):
 * ────────────────────────
 * El AuthGuard asigna `req.user = data.user` (objeto User de Supabase).
 * Ese objeto expone:
 *   - user.id           → UUID del usuario en auth.users
 *   - user.app_metadata → { provider, providers, ... } — sin tenant_id por ahora
 *   - user.user_metadata → datos opcionales del signup
 *
 * La tabla `profiles` (TRA-14) aún no está en el schema Prisma porque vive en
 * el schema `public` de Supabase pero no fue incluida en prisma/schema.prisma.
 *
 * ESTRATEGIA IMPLEMENTADA:
 * ────────────────────────
 * 1. Leer app_metadata.tenant_id  ← cuando TRA-17 lo inyecte en el JWT
 * 2. Leer user_metadata.tenant_id ← alternativa durante desarrollo
 * 3. Consultar profiles.tenant_id via Prisma raw query ← cuando TRA-14 lo agregue
 * 4. Si ninguna fuente entrega tenantId → lanzar UnauthorizedException explícita
 *    (nunca usar un fallback silencioso con el primer tenant de la BD)
 *
 * QUÉ FALTA para que esto funcione 100%:
 * ────────────────────────────────────────
 * Opción A (recomendada): TRA-17 agrega tenant_id a app_metadata del usuario
 *   → En Supabase Dashboard o vía service_role:
 *     UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"tenant_id":"<cuid>"}'
 *     WHERE id = '<user_uuid>';
 *   → El JWT incluirá app_metadata.tenant_id automáticamente.
 *
 * Opción B: Agregar profiles al schema Prisma y hacer JOIN aquí.
 *   Agregar a prisma/schema.prisma:
 *     model Profile {
 *       id        String  @id           // auth.users.id
 *       tenantId  String? @map("tenant_id")
 *       role      String  @default("mechanic")
 *       fullName  String? @map("full_name")
 *       avatarUrl String? @map("avatar_url")
 *       @@map("profiles")
 *     }
 *   Luego descomentar la estrategia 3 en este service.
 */

import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Tipo mínimo del usuario que inyecta AuthGuard en req.user
export interface AuthUser {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resuelve el tenantId del usuario autenticado.
   * Lanza UnauthorizedException si no puede determinarlo — nunca devuelve undefined.
   */
  async resolveTenantId(user: AuthUser): Promise<string> {
    // ── Estrategia 1: app_metadata.tenant_id (inyectado por TRA-17) ──────────
    const fromAppMeta = user.app_metadata?.['tenant_id'];
    if (typeof fromAppMeta === 'string' && fromAppMeta.length > 0) {
      return fromAppMeta;
    }

    // ── Estrategia 2: user_metadata.tenant_id (útil en desarrollo) ───────────
    const fromUserMeta = user.user_metadata?.['tenant_id'];
    if (typeof fromUserMeta === 'string' && fromUserMeta.length > 0) {
      return fromUserMeta;
    }

    // ── Estrategia 3: tabla profiles (cuando TRA-14 la agregue a Prisma) ─────
    // Descomentar cuando `profiles` esté en prisma/schema.prisma:
    //
    // try {
    //   const profile = await this.prisma.profile.findUnique({
    //     where: { id: user.id },
    //     select: { tenantId: true },
    //   });
    //   if (profile?.tenantId) return profile.tenantId;
    // } catch {
    //   // profiles aún no existe en el schema — ignorar silenciosamente
    // }

    // ── Sin tenantId: fallo explícito ─────────────────────────────────────────
    throw new UnauthorizedException(
      'No se pudo determinar el tenant del usuario. ' +
        'Asegúrate de que TRA-17 haya asignado tenant_id en app_metadata ' +
        'o que TRA-14 haya creado el perfil con tenant_id.',
    );
  }
}
