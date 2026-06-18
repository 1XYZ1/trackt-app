import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { login } from "@/app/actions/auth";
import { LoginForm } from "./login-form";

vi.mock("@/app/actions/auth", () => ({
  login: vi.fn(),
}));

const loginMock = vi.mocked(login);

describe("LoginForm", () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it("renderiza campos principales y accion de ingreso", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contrase/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /iniciar sesion/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /olvidaste/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("muestra validacion si el correo no es valido", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/correo/i), "correo-invalido");
    await user.tab();

    expect(
      await screen.findByText(/ingresa un correo valido/i),
    ).toBeInTheDocument();
  });

  it("envia credenciales validas como FormData", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/correo/i), "demo@trackt.cl");
    await user.type(screen.getByLabelText(/contrase/i), "secret123");
    await user.click(screen.getByRole("button", { name: /iniciar sesion/i }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
    const formData = loginMock.mock.calls[0][0] as FormData;
    expect(formData.get("email")).toBe("demo@trackt.cl");
    expect(formData.get("password")).toBe("secret123");
  });
});
