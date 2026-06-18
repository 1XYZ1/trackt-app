import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimelineItem } from "./timeline-item";

describe("TimelineItem", () => {
  it("muestra titulo, descripcion, usuario y fecha", () => {
    render(
      <TimelineItem
        evento={{
          descripcion: "Ticket asignado al mecanico de turno.",
          fecha: "Hoy 09:30",
          id: "event-1",
          titulo: "Estado actualizado",
          usuario: { nombre: "Maria Soto" },
        }}
      />,
    );

    expect(screen.getByText("Estado actualizado")).toBeInTheDocument();
    expect(
      screen.getByText("Ticket asignado al mecanico de turno."),
    ).toBeInTheDocument();
    expect(screen.getByText("Maria Soto")).toBeInTheDocument();
    expect(screen.getByText("Hoy 09:30")).toBeInTheDocument();
  });

  it("muestra badge de estado cuando el evento lo incluye", () => {
    render(
      <TimelineItem
        evento={{
          estado: "ASIGNADO",
          fecha: "Hoy 10:15",
          id: "event-2",
          titulo: "Asignacion confirmada",
        }}
      />,
    );

    expect(screen.getByText("Asignado")).toBeInTheDocument();
    expect(screen.getByText("Sistema")).toBeInTheDocument();
  });
});
