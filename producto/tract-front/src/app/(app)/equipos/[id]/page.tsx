import type { Metadata } from "next";
import { EquipoDetalleClient } from "./equipo-detalle-client";

type EquipoDetallePageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Ficha de equipo | Trackt",
  description: "Ficha central del equipo: resumen, historial y mantenimiento.",
};

export default async function EquipoDetallePage({
  params,
}: EquipoDetallePageProps) {
  const { id } = await params;
  return <EquipoDetalleClient id={id} />;
}
