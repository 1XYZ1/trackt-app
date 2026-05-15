import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Header } from '@/components/layout/header';
import { AuthProvider } from '@/contexts/auth-context';
import { requireSession } from '@/lib/auth/require-role';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireSession();

  return (
    <AuthProvider profile={profile}>
      <SidebarProvider>
        <AppSidebar
          user={{
            email: profile.email,
            name: profile.fullName ?? profile.email,
            avatar: profile.avatarUrl ?? undefined,
          }}
          role={profile.role}
        />
        <SidebarInset>
          <Header />
          <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  );
}
