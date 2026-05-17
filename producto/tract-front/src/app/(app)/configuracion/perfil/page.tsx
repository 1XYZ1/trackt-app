import { requireSession } from '@/lib/auth/require-role';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PerfilForm } from './perfil-form';

export default async function PerfilPage() {
  const profile = await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Mi perfil</h1>
        <p className="text-muted-foreground text-sm">
          Actualiza tu nombre y foto de perfil.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos personales</CardTitle>
              <CardDescription>
                Tu nombre se muestra en el sidebar y en los tickets que asignas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PerfilForm
                userId={profile.id}
                initialFullName={profile.fullName ?? ''}
                initialAvatarUrl={profile.avatarUrl}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cuenta</CardTitle>
            <CardDescription>Informacion del sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Correo
              </p>
              <p className="break-all">{profile.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Rol
              </p>
              <Badge variant="secondary" className="mt-1 capitalize">
                {profile.role}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Tenant
              </p>
              <p className="break-all text-muted-foreground">
                {profile.tenantId}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
