import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("renderiza la etiqueta del estado", () => {
    render(<StatusBadge estado="PENDIENTE" />);

    expect(screen.getByText("Pendiente")).toBeInTheDocument();
  });

  it("usa tokens de color por estado", () => {
    const { container } = render(<StatusBadge estado="CERRADO" />);

    expect(container.firstChild).toHaveClass(
      "border-estado-cerrado-border",
      "bg-estado-cerrado-bg",
      "text-estado-cerrado-text",
    );
  });

  it("permite ocultar el icono sin ocultar el punto ni la etiqueta", () => {
    const { container } = render(
      <StatusBadge estado="CANCELADO" showIcon={false} />,
    );

    expect(screen.getByText("Cancelado")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });
});
