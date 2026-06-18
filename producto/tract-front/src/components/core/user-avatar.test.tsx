import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserAvatar } from "./user-avatar";

describe("UserAvatar", () => {
  it("usa iniciales desde el nombre del usuario", () => {
    render(<UserAvatar user={{ nombre: "Maria Soto" }} />);

    expect(screen.getByLabelText("Maria Soto")).toBeInTheDocument();
    expect(screen.getByText("MS")).toBeInTheDocument();
  });

  it("usa iniciales desde el correo si no hay nombre", () => {
    render(<UserAvatar user={{ email: "ana.mecanica@trackt.cl" }} />);

    expect(screen.getByLabelText("ana.mecanica@trackt.cl")).toBeInTheDocument();
    expect(screen.getByText("AM")).toBeInTheDocument();
  });

  it("usa fallback cuando no hay usuario asignado", () => {
    render(<UserAvatar user={null} />);

    expect(screen.getByLabelText("Usuario sin asignar")).toBeInTheDocument();
    expect(screen.getByText("U")).toBeInTheDocument();
  });
});
