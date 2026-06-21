'use client';

import Link from 'next/link';
import { ChevronsUpDown, LogOut, UserCog } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { logout } from '@/app/actions/auth';
import { roleLabel } from '@/lib/auth/role-labels';
import type { UserRole } from '@/lib/auth/profile';
import type { User } from './types';

interface Props {
  user: User;
  role: UserRole;
}

/**
 * Menú de cuenta en el footer del sidebar: avatar + nombre + email como trigger;
 * el dropdown agrupa "Mi perfil" y "Cerrar sesión". Centraliza las acciones de
 * cuenta (antes dispersas entre el header y el grupo "Cuenta" del nav).
 */
export function NavUser({ user, role }: Props) {
  const { isMobile } = useSidebar();
  const initials = (user.name || user.email).slice(0, 2).toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
                size="lg"
              />
            }
          >
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage alt={user.email} src={user.avatar} />
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 overflow-hidden text-left text-sm leading-tight">
              <span className="truncate font-semibold">
                {user.name || 'Usuario'}
              </span>
              <span className="truncate text-muted-foreground text-xs">
                {user.email}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1.5 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage alt={user.email} src={user.avatar} />
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 overflow-hidden text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {user.name || 'Usuario'}
                  </span>
                  <span className="truncate text-muted-foreground text-xs">
                    {roleLabel(role)}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/configuracion/perfil" />}>
                <UserCog />
                Mi perfil
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <form action={logout} className="w-full">
              <DropdownMenuItem
                render={<button className="w-full" type="submit" />}
                variant="destructive"
              >
                <LogOut />
                Cerrar sesión
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
