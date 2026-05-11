import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Header } from '@/components/layout/header';
// import { redirect } from 'next/navigation';
// import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO(auth): Reactivar esta proteccion cuando terminemos la etapa de UI/UX.
  // const supabase = await createClient();
  // const {
  //   data: { user },
  // } = await supabase.auth.getUser();
  //
  // if (!user) {
  //   redirect('/login');
  // }

  // Usuario temporal solo para desarrollo frontend sin sesion Supabase.
  const user: {
    email: string;
    user_metadata?: {
      avatar_url?: string;
      full_name?: string;
    };
  } = {
    email: 'demo@trackt.local',
    user_metadata: {
      full_name: 'Usuario Demo',
    },
  };

  return (
    <SidebarProvider>
      <AppSidebar
        user={{
          email: user.email ?? 'unknown',
          name: (user.user_metadata?.full_name as string) ?? user.email ?? 'Usuario',
          avatar: (user.user_metadata?.avatar_url as string) ?? undefined,
        }}
      />
      <SidebarInset>
        <Header />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
