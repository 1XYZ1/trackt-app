import type { Metadata } from "next";
import { MisTicketsClient } from "./mis-tickets-client";

export const metadata: Metadata = {
  title: "Mis tickets | Trackt",
  description: "Tickets asignados al mecanico para ejecucion en terreno.",
};

export default function MisTicketsPage() {
  return <MisTicketsClient />;
}
