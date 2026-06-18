import type { Metadata } from "next";
import { ReportesClient } from "./reportes-client";

export const metadata: Metadata = {
  title: "Reportes | Trackt",
  description: "Reportes operativos en JSON y CSV.",
};

export default function ReportesPage() {
  return <ReportesClient />;
}
