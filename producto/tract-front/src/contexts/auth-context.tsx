'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { SessionProfile, UserRole } from '@/lib/auth/profile';

const AuthContext = createContext<SessionProfile | null>(null);

export function AuthProvider({
  profile,
  children,
}: {
  profile: SessionProfile;
  children: ReactNode;
}) {
  return <AuthContext.Provider value={profile}>{children}</AuthContext.Provider>;
}

export function useAuth(): SessionProfile {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export function useRole(): UserRole {
  return useAuth().role;
}

export function useHasRole(...roles: UserRole[]): boolean {
  return roles.includes(useRole());
}
