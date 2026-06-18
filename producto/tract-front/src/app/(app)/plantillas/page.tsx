import type { Metadata } from "next";
import { PlantillasClient } from "./plantillas-client";

export const metadata: Metadata = {
  title: "Plantillas | Trackt",
  description: "Plantillas de mantenimiento reutilizables.",
};

export default function PlantillasPage() {
  return <PlantillasClient />;
}
