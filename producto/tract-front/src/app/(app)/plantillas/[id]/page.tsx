import type { Metadata } from "next";
import { PlantillaDetalleClient } from "./plantilla-detalle-client";

type PlantillaDetallePageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Detalle de plantilla | Trackt",
  description: "Insumos y checklist de la plantilla de mantenimiento.",
};

export default async function PlantillaDetallePage({
  params,
}: PlantillaDetallePageProps) {
  const { id } = await params;
  return <PlantillaDetalleClient id={id} />;
}
