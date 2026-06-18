import 'server-only';
import { redirect } from 'next/navigation';
import { getSessionProfile, type SessionProfile, type UserRole } from './profile';
import { defaultRouteForRole } from './default-route';

export async function requireSession(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/login');
  return profile;
}

export async function requireRole(...roles: UserRole[]): Promise<SessionProfile> {
  const profile = await requireSession();
  if (!roles.includes(profile.role)) {
    // Mandar a su propia home, no a /dashboard fijo (evita loop si el rol
    // tampoco puede ver /dashboard, p.ej. jefe_inventario).
    redirect(defaultRouteForRole(profile.role));
  }
  return profile;
}
