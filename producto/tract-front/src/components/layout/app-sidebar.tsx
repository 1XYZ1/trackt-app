'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { NavGroup } from './nav-group';
import { NavUser } from './nav-user';
import { TeamSwitcher } from './team-switcher';
import { sidebarData } from './data/sidebar-data';
import type { User } from './types';

interface Props {
  user: User;
}

export function AppSidebar({ user }: Props) {
  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <TeamSwitcher teams={sidebarData.teams} />
      </SidebarHeader>
      <SidebarContent>
        {sidebarData.navGroups.map((group) => (
          <NavGroup key={group.title} {...group} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
