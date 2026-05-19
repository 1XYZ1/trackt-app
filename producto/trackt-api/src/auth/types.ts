export type UserRole = 'admin' | 'jefe_taller' | 'mechanic';

export interface AuthUser {
  id: string;
  email?: string;
  role: UserRole;
  tenantId: string;
  fullName?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}
