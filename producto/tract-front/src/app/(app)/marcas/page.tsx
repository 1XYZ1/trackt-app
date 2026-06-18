import type { Metadata } from "next";
import { MarcasClient } from "./marcas-client";

export const metadata: Metadata = {
  title: "Marcas | Trackt",
  description: "Catálogo de marcas para equipos y repuestos.",
};

export default function MarcasPage() {
  return <MarcasClient />;
}
