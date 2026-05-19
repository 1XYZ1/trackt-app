import 'server-only';
import { redirect } from 'next/navigation';
import { getSessionProfile, type SessionProfile, type UserRole } from './profile';

export async function requireSession(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/login');
  return profile;
}

export async function requireRole(...roles: UserRole[]): Promise<SessionProfile> {
  const profile = await requireSession();
  if (!roles.includes(profile.role)) {
    redirect('/dashboard');
  }
  return profile;
}
