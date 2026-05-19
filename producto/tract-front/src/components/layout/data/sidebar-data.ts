import {
  LayoutDashboard,
  Truck,
  Wrench,
  ClipboardList,
  Ticket,
  CheckCircle2,
  Users,
  UserCog,
  Command,
  Gauge,
  Package,
} from 'lucide-react';
import type { SidebarData } from '../types';

export const sidebarData: SidebarData = {
  teams: [
    {
      name: 'Trackt',
      logo: Command,
      plan: 'Gestion de equipos',
    },
  ],
  navGroups: [
    {
      title: 'Mi trabajo',
      roles: ['mechanic'],
      items: [
        {
          title: 'Mis tickets',
          url: '/mis-tickets',
          icon: Ticket,
          roles: ['mechanic'],
        },
      ],
    },
    {
      title: 'General',
      roles: ['admin', 'jefe_taller'],
      items: [
        {
          title: 'Dashboard',
          url: '/dashboard',
          icon: LayoutDashboard,
          roles: ['admin', 'jefe_taller'],
        },
        {
          title: 'Equipos',
          url: '/equipos',
          icon: Truck,
          roles: ['admin', 'jefe_taller'],
        },
        {
          title: 'Mantenciones',
          url: '/mantenciones',
          icon: Wrench,
          roles: ['admin', 'jefe_taller'],
        },
        {
          title: 'Ordenes',
          url: '/ordenes',
          icon: ClipboardList,
          roles: ['admin', 'jefe_taller'],
        },
        {
          title: 'Tickets',
          url: '/tickets',
          icon: Ticket,
          roles: ['admin', 'jefe_taller'],
        },
        {
          title: 'Inventario',
          url: '/inventario',
          icon: Package,
          roles: ['admin', 'jefe_taller'],
        },
      ],
    },
    {
      title: 'Taller',
      roles: ['admin', 'jefe_taller'],
      items: [
        {
          title: 'Carga de mecanicos',
          url: '/taller/carga',
          icon: Gauge,
          roles: ['admin', 'jefe_taller'],
        },
      ],
    },
    {
      title: 'Administracion',
      roles: ['admin'],
      items: [
        {
          title: 'Pendientes de validar',
          url: '/tickets?estado=EJECUTADO',
          icon: CheckCircle2,
          roles: ['admin'],
        },
        { title: 'Usuarios', url: '/usuarios', icon: Users, roles: ['admin'] },
      ],
    },
    {
      title: 'Cuenta',
      items: [
        { title: 'Mi perfil', url: '/configuracion/perfil', icon: UserCog },
      ],
    },
  ],
};
