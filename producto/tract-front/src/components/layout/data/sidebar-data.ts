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
  ShieldCheck,
  Command,
  GalleryVerticalEnd,
} from 'lucide-react';
import type { SidebarData } from '../types';

export const sidebarData: SidebarData = {
  teams: [
    {
      name: 'Trackt',
      logo: Command,
      plan: 'Gestión de equipos',
    },
    {
      name: 'Demo Co.',
      logo: GalleryVerticalEnd,
      plan: 'Free',
    },
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
        { title: 'Equipos', url: '/equipos', icon: Truck },
        { title: 'Mantenciones', url: '/mantenciones', icon: Wrench },
        { title: 'Tareas', url: '/tareas', icon: ClipboardList, badge: '3' },
        { title: 'Alertas', url: '/alertas', icon: AlertTriangle },
      ],
    },
    {
      title: 'Administración',
      items: [
        { title: 'Usuarios', url: '/usuarios', icon: Users },
        { title: 'Permisos', url: '/permisos', icon: ShieldCheck },
      ],
    },
    {
      title: 'Otros',
      items: [
        {
          title: 'Configuración',
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
