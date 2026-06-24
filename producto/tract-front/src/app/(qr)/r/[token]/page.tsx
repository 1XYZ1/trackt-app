import { redirect } from "next/navigation";
import { AuthProvider } from "@/contexts/auth-context";
import { getSessionProfile } from "@/lib/auth/profile";
import { RepuestoQrClient } from "@/components/inventario/qr/repuesto-qr-client";

type Props = {
  params: Promise<{ token: string }>;
};

// Página dedicada del repuesto a la que redirige el QR escaneado (espejo de
// /q/[token] para equipos). Requiere sesión: si no hay, manda a login
// conservando el destino para volver aquí tras autenticarse. El contenido se
// resuelve por tenant dentro de RepuestoQrClient (vía el endpoint QR).
export default async function RepuestoQrPage({ params }: Props) {
  const { token } = await params;

  const profile = await getSessionProfile();
  if (!profile) {
    redirect(`/login?redirect=${encodeURIComponent(`/r/${token}`)}`);
  }

  return (
    <AuthProvider profile={profile}>
      <RepuestoQrClient token={token} />
    </AuthProvider>
  );
}
