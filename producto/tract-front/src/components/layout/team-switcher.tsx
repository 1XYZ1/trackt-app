'use client';

import Image from 'next/image';
import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';
import type { Team } from './types';

interface Props {
  teams: Team[];
}

export function TeamSwitcher({ teams }: Props) {
  const activeTeam = teams[0];
  if (!activeTeam) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex h-11 items-center gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-sidebar-accent/50 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Image
            alt="Trackt"
            className="h-[50px] w-[50px] shrink-0 object-contain"
            height={50}
            priority
            src="/trackt-sidebar-logo.png"
            width={50}
          />
          <div className="grid flex-1 overflow-hidden text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold">{activeTeam.name}</span>
            <span className="truncate text-muted-foreground text-xs">
              {activeTeam.plan}
            </span>
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
