import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require-role";
import { RepuestoDetalleClient } from "./repuesto-detalle-client";

export const metadata: Metadata = {
  title: "Detalle de repuesto | Trackt",
  description: "Ficha de repuesto con stock y movimientos recientes.",
};

interface Params {
  id: string;
}

export default async function RepuestoDetallePage({
  params,
}: {
  params: Promise<Params>;
}) {
  // mechanic puede ver detalle (backend devuelve movs vacios para mechanic).
  await requireRole("admin", "jefe_taller", "mechanic");
  const { id } = await params;
  return <RepuestoDetalleClient id={id} />;
}
