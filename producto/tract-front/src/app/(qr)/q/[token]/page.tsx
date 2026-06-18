import { redirect } from "next/navigation";
import { AuthProvider } from "@/contexts/auth-context";
import { getSessionProfile } from "@/lib/auth/profile";
import { EquipoQrClient } from "@/components/equipos/qr/equipo-qr-client";

type Props = {
  params: Promise<{ token: string }>;
};

// Página dedicada del equipo a la que redirige el QR escaneado.
// Requiere sesión: si no hay, manda a login conservando el destino para volver
// aquí tras autenticarse. El contenido y las acciones se diferencian por rol
// dentro de EquipoQrClient (vía useRole()).
export default async function EquipoQrPage({ params }: Props) {
  const { token } = await params;

  const profile = await getSessionProfile();
  if (!profile) {
    redirect(`/login?redirect=${encodeURIComponent(`/q/${token}`)}`);
  }

  return (
    <AuthProvider profile={profile}>
      <EquipoQrClient token={token} />
    </AuthProvider>
  );
}
