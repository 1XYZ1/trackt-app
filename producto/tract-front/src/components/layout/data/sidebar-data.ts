import {
  LayoutDashboard,
  Truck,
  Wrench,
  ClipboardList,
  AlertTriangle,
  Users,
  Settings,
  HelpCircle,
  Bell,
  Palette,
  UserCog,
  Command,
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
      title: 'General',
      items: [
        { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
        { title: 'Equipos', url: '/equipos', icon: Truck },
        { title: 'Mantenciones', url: '/mantenciones', icon: Wrench },
        { title: 'Ordenes', url: '/ordenes-trabajo', icon: ClipboardList },
        { title: 'Alertas', url: '/alertas', icon: AlertTriangle },
      ],
    },
    {
      title: 'Administracion',
      roles: ['admin'],
      items: [
        { title: 'Usuarios', url: '/usuarios', icon: Users, roles: ['admin'] },
      ],
    },
    {
      title: 'Otros',
      items: [
        {
          title: 'Configuracion',
          icon: Settings,
          items: [
            { title: 'Perfil', url: '/configuracion/perfil', icon: UserCog },
            { title: 'Apariencia', url: '/configuracion/apariencia', icon: Palette },
            { title: 'Notificaciones', url: '/configuracion/notificaciones', icon: Bell },
          ],
        },
        { title: 'Ayuda', url: '/ayuda', icon: HelpCircle },
      ],
    },
  ],
};
