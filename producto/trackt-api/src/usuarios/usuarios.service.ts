/**
 * UsuariosService
 * ===============
 * Lee usuarios desde la tabla `profiles` del schema `public`.
 *
 * `profiles` no está modelada en prisma/schema.prisma (es parte de TRA-14),
 * por lo que usamos `prisma.$queryRaw` con un tipo explícito.
 *
 * Estructura esperada de `public.profiles` (TRA-14):
 *   id         UUID    → auth.users.id
 *   full_name  TEXT
 *   avatar_url TEXT
 *   role       TEXT    CHECK (role IN ('admin', 'mechanic'))
 *   tenant_id  TEXT    → tenants.id  ← columna añadida por TRA-17
 *   created_at TIMESTAMPTZ
 *   updated_at TIMESTAMPTZ
 *
 * ⚠ PENDIENTE: TRA-17 debe agregar tenant_id a profiles para que el filtro
 *   por tenant funcione. Sin esa columna la query filtrará 0 filas.
 *
 * Alternativa futura: agregar `Profile` a prisma/schema.prisma y usar
 * `prisma.profile.findMany(...)` en lugar de $queryRaw.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ListUsuariosQueryDto,
  normalizeRol,
} from './dto/list-usuarios-query.dto';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../common/utils/pagination';
import { Prisma } from '@prisma/client';

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
}

interface CountRow {
  count: bigint;
}

// Respuesta pública normalizada
export interface UsuarioPublico {
  id: string;
  email: string | null;
  fullName: string | null;
  role: string;
}

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: ListUsuariosQueryDto,
  ): Promise<PaginatedResult<UsuarioPublico>> {
    const { page = 1, limit = 10, search, rol } = query;
    const rolNormalizado = normalizeRol(rol);
    const offset = (page - 1) * limit;

    // Condiciones dinámicas
    const conditions: Prisma.Sql[] = [
      Prisma.sql`p.tenant_id = ${tenantId}`,
    ];

    if (rolNormalizado) {
      conditions.push(Prisma.sql`p.role = ${rolNormalizado}`);
    }

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        Prisma.sql`(
          p.full_name ILIKE ${pattern}
          OR u.email   ILIKE ${pattern}
        )`,
      );
    }

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    // JOIN con auth.users para obtener email
    // auth.users vive en el schema "auth" de Supabase — accesible desde SQL
    const rows = await this.prisma.$queryRaw<ProfileRow[]>`
      SELECT
        p.id,
        u.email,
        p.full_name,
        p.role
      FROM   public.profiles   AS p
      JOIN   auth.users        AS u ON u.id = p.id
      ${whereClause}
      ORDER  BY p.full_name ASC NULLS LAST
      LIMIT  ${limit}
      OFFSET ${offset}
    `;

    const [countResult] = await this.prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM   public.profiles AS p
      JOIN   auth.users      AS u ON u.id = p.id
      ${whereClause}
    `;

    const total = Number(countResult.count);

    const data: UsuarioPublico[] = rows.map((r) => ({
      id: r.id,
      email: r.email ?? null,
      fullName: r.full_name ?? null,
      role: r.role,
    }));

    return buildPaginatedResult(data, total, page, limit);
  }
}
