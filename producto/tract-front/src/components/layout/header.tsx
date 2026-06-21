'use client';

import { Search } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { ThemeSwitch } from '@/components/theme-switch';
import { NotificacionesBell } from '@/components/layout/notificaciones-bell';
import { cn } from '@/lib/utils';

export function Header({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        'flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12',
        'sticky top-0 z-40 bg-background',
        className,
      )}
    >
      <div className="flex w-full items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." className="h-9 pl-8" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitch />
          <NotificacionesBell />
        </div>
      </div>
    </header>
  );
}
