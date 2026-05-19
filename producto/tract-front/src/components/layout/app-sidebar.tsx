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
import type { User, NavGroup as NavGroupType, NavItem } from './types';
import type { UserRole } from '@/lib/auth/profile';

interface Props {
  user: User;
  role: UserRole;
}

function filterByRole(role: UserRole, groups: NavGroupType[]): NavGroupType[] {
  const allow = (rolesAllowed?: UserRole[]) =>
    !rolesAllowed || rolesAllowed.includes(role);

  return groups
    .filter((g) => allow(g.roles))
    .map((g) => ({
      ...g,
      items: g.items
        .filter((item: NavItem) => allow(item.roles))
        .map((item) => {
          if ('items' in item && item.items) {
            return {
              ...item,
              items: item.items.filter((sub) => allow(sub.roles)),
            };
          }
          return item;
        })
        .filter((item) => {
          if ('items' in item && item.items) return item.items.length > 0;
          return true;
        }),
    }))
    .filter((g) => g.items.length > 0);
}

export function AppSidebar({ user, role }: Props) {
  const groups = filterByRole(role, sidebarData.navGroups);

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <TeamSwitcher teams={sidebarData.teams} />
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
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
