import type * as React from 'react';
import type { UserRole } from '@/lib/auth/profile';

export type User = {
  name: string;
  email: string;
  avatar?: string;
};

export type Team = {
  name: string;
  logo: React.ElementType;
  plan: string;
};

type BaseNavItem = {
  title: string;
  badge?: string;
  icon?: React.ElementType;
  roles?: UserRole[];
};

export type NavLink = BaseNavItem & {
  url: string;
  items?: never;
};

export type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: string })[];
  url?: never;
};

export type NavItem = NavCollapsible | NavLink;

export type NavGroup = {
  title: string;
  items: NavItem[];
  roles?: UserRole[];
};

export type SidebarData = {
  teams: Team[];
  navGroups: NavGroup[];
};
