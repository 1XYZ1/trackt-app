import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { forgotPassword } from "@/app/actions/auth";
import { ForgotForm } from "./forgot-form";

vi.mock("@/app/actions/auth", () => ({
  forgotPassword: vi.fn(),
}));

const forgotPasswordMock = vi.mocked(forgotPassword);

describe("ForgotForm", () => {
  beforeEach(() => {
    forgotPasswordMock.mockReset();
  });

  it("renderiza el campo de correo y boton de envio", () => {
    render(<ForgotForm />);

    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /enviar enlace/i }),
    ).toBeInTheDocument();
  });

  it("muestra validacion si el correo no es valido", async () => {
    const user = userEvent.setup();
    render(<ForgotForm />);

    await user.type(screen.getByLabelText(/correo/i), "correo-invalido");
    await user.tab();

    expect(
      await screen.findByText(/ingresa un correo v[aá]lido/i),
    ).toBeInTheDocument();
  });

  it("envia el correo valido como FormData", async () => {
    const user = userEvent.setup();
    render(<ForgotForm />);

    await user.type(screen.getByLabelText(/correo/i), "demo@trackt.cl");
    await user.click(screen.getByRole("button", { name: /enviar enlace/i }));

    await waitFor(() => expect(forgotPasswordMock).toHaveBeenCalledTimes(1));
    const formData = forgotPasswordMock.mock.calls[0][0] as FormData;
    expect(formData.get("email")).toBe("demo@trackt.cl");
  });
});
