import type { Metadata } from "next";
import { OrdenesClient } from "./ordenes-client";

export const metadata: Metadata = {
  title: "Órdenes de Trabajo | Trackt",
  description:
    "Listado y trazabilidad de órdenes de trabajo: estados, SLA y responsables.",
};

export default function OrdenesPage() {
  return <OrdenesClient />;
}
