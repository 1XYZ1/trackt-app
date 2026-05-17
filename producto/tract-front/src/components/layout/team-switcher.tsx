'use client';

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
        <div className="flex items-center gap-2 rounded-md p-2 text-sm">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <activeTeam.logo className="size-4" />
          </div>
          <div className="grid flex-1 overflow-hidden text-left leading-tight">
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
