import {
  LayoutDashboard,
  Truck,
  Wrench,
  ClipboardList,
  Ticket,
  CheckCircle2,
  Users,
  Gauge,
  Package,
  History,
  ClipboardCheck,
  Tag,
  Boxes,
  ListChecks,
  BarChart3,
} from 'lucide-react';
import type { SidebarData } from '../types';

export const sidebarData: SidebarData = {
  teams: [
    {
      name: 'Trackt',
      plan: 'Gestion de equipos',
    },
  ],
  navGroups: [
    {
      title: 'Panel',
      roles: ['admin', 'jefe_taller'],
      items: [
        {
          title: 'Dashboard',
          url: '/dashboard',
          icon: LayoutDashboard,
          roles: ['admin', 'jefe_taller'],
        },
        {
          title: 'Reportes',
          url: '/reportes',
          icon: BarChart3,
          roles: ['admin', 'jefe_taller'],
        },
      ],
    },
    {
      title: 'Equipos',
      roles: ['admin', 'jefe_taller'],
      items: [
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
          title: 'Plantillas',
          url: '/plantillas',
          icon: ListChecks,
          roles: ['admin', 'jefe_taller'],
        },
      ],
    },
    {
      title: 'Operación',
      roles: ['admin', 'jefe_taller'],
      items: [
        {
          title: 'Órdenes',
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
          title: 'Pendientes de validar',
          url: '/tickets?estado=EJECUTADO',
          icon: CheckCircle2,
          roles: ['admin'],
        },
        {
          title: 'Carga de mecánicos',
          url: '/taller/carga',
          icon: Gauge,
          roles: ['admin', 'jefe_taller'],
        },
      ],
    },
    {
      title: 'Inventario',
      roles: ['admin', 'jefe_taller', 'jefe_inventario'],
      items: [
        {
          title: 'Inventario',
          url: '/inventario',
          icon: Package,
          roles: ['admin', 'jefe_taller', 'jefe_inventario'],
        },
        {
          title: 'Movimientos',
          url: '/inventario/movimientos',
          icon: History,
          roles: ['admin', 'jefe_taller', 'jefe_inventario'],
        },
        {
          title: 'Solicitudes pendientes',
          url: '/inventario/reservas-pendientes',
          icon: ClipboardCheck,
          roles: ['admin', 'jefe_taller', 'jefe_inventario'],
        },
      ],
    },
    {
      title: 'Administración',
      roles: ['admin'],
      items: [
        { title: 'Marcas', url: '/marcas', icon: Tag, roles: ['admin'] },
        {
          title: 'Tipos de equipo',
          url: '/tipos-equipo',
          icon: Boxes,
          roles: ['admin'],
        },
        { title: 'Usuarios', url: '/usuarios', icon: Users, roles: ['admin'] },
      ],
    },
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
  ],
};
