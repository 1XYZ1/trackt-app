import { requireRole } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { InviteForm } from './invite-form';

interface ProfileRow {
  id: string;
  role: 'admin' | 'mechanic' | 'jefe_taller';
  full_name: string | null;
  created_at: string;
}

export default async function UsuariosPage() {
  const session = await requireRole('admin');
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role, full_name, created_at')
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: false });

  const rows = (profiles ?? []) as ProfileRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Usuarios</h1>
        <p className="text-muted-foreground text-sm">
          Gestion de usuarios del tenant {session.tenantId}.
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
            Usuarios registrados ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Creado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Sin usuarios
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.full_name ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant={p.role === 'admin' ? 'default' : 'secondary'}>
                        {p.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
