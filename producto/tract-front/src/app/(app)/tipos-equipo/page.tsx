import type { Metadata } from "next";
import { TiposEquipoClient } from "./tipos-equipo-client";

export const metadata: Metadata = {
  title: "Tipos de equipo | Trackt",
  description: "Catálogo de tipos de equipo y sus repuestos default.",
};

export default function TiposEquipoPage() {
  return <TiposEquipoClient />;
}
