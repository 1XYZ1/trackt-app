import type { Metadata } from "next";
import { OrdenDetalleClient } from "./orden-detalle-client";

type OrdenDetallePageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Detalle OT | Trackt",
  description: "Detalle de orden de trabajo y tickets derivados.",
};

export default async function OrdenDetallePage({
  params,
}: OrdenDetallePageProps) {
  const { id } = await params;

  return <OrdenDetalleClient id={id} />;
}
