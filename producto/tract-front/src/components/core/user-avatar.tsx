import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UsuarioResumen } from "./types";

function getInitials(user?: UsuarioResumen | null) {
  const source = user?.nombre || user?.email || "Usuario";
  const parts = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase()).join("") || "U";
}

export interface UserAvatarProps {
  user?: UsuarioResumen | null;
  className?: string;
}

/**
 * Avatar reutilizable para usuarios de TRACKT con fallback de iniciales.
 *
 * @example
 * <UserAvatar user={{ nombre: "Maria Soto", email: "maria@trackt.cl" }} />
 */
export function UserAvatar({ className, user }: UserAvatarProps) {
  const label = user?.nombre || user?.email || "Usuario sin asignar";

  return (
    <Avatar
      aria-label={label}
      className={cn("size-8 border border-border bg-secondary text-xs", className)}
    >
      {user?.avatarUrl && <AvatarImage alt={label} src={user.avatarUrl} />}
      <AvatarFallback className="bg-secondary text-secondary-foreground">
        {getInitials(user)}
      </AvatarFallback>
    </Avatar>
  );
}
