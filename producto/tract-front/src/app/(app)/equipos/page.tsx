import type { Metadata } from "next";
import { EquiposClient } from "./equipos-client";

export const metadata: Metadata = {
  title: "Equipos 2 | Trackt",
  description: "Listado de equipos operacionales registrados para mantenimiento.",
};

export default function EquiposPage() {
  return <EquiposClient />;
}
