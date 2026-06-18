import { Users } from 'lucide-react';
import { requireRole } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/core';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { roleLabel } from '@/lib/auth/role-labels';
import type { UserRole } from '@/lib/auth/profile';
import { InviteForm } from './invite-form';

interface ProfileRow {
  id: string;
  role: UserRole;
  full_name: string | null;
  created_at: string;
}

function roleBadgeVariant(
  role: UserRole,
): 'default' | 'secondary' | 'outline' {
  if (role === 'admin') return 'default';
  if (role === 'mechanic') return 'secondary';
  return 'outline'; // jefe_taller, jefe_inventario
}

function initials(name: string | null) {
  const base = (name ?? '').trim();
  if (!base) return '?';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? '?';
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

export default async function UsuariosPage() {
  const session = await requireRole('admin');
  const supabase = await createClient();

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, created_at')
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: false });

  const rows = (profiles ?? []) as ProfileRow[];

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
          <Users className="size-3.5" />
          Administración del tenant
        </div>
        <h1 className="font-semibold text-2xl tracking-tight">Usuarios</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
          Invita y administra a las personas con acceso a tu organización.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invitar nuevo usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Usuarios registrados
            <span className="ml-2 font-normal text-muted-foreground text-sm tabular-nums">
              {rows.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className={error || rows.length === 0 ? undefined : 'p-0'}>
          {error ? (
            <EmptyState
              icon="wrench"
              message={`No se pudieron cargar los usuarios: ${error.message}`}
              title="Error al cargar usuarios"
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon="inbox"
              message="Invita a tu primer usuario con el formulario de arriba."
              title="Sin usuarios registrados"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Creado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">
                            {initials(p.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {p.full_name ?? 'Sin nombre'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant(p.role)}>
                        {roleLabel(p.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm tabular-nums">
                      {new Date(p.created_at).toLocaleDateString('es-CL')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
