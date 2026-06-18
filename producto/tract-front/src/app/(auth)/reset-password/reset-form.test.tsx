import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPassword } from "@/app/actions/auth";
import { ResetForm } from "./reset-form";

vi.mock("@/app/actions/auth", () => ({
  resetPassword: vi.fn(),
}));

const resetPasswordMock = vi.mocked(resetPassword);

describe("ResetForm", () => {
  beforeEach(() => {
    resetPasswordMock.mockReset();
  });

  it("renderiza los campos de nueva clave y confirmacion", () => {
    render(<ResetForm />);

    expect(screen.getByLabelText(/nueva contrase/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar contrase/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /actualizar contrase/i }),
    ).toBeInTheDocument();
  });

  it("muestra error si las contrasenas no coinciden", async () => {
    const user = userEvent.setup();
    render(<ResetForm />);

    await user.type(screen.getByLabelText(/nueva contrase/i), "secret123");
    await user.type(screen.getByLabelText(/confirmar contrase/i), "secret456");
    await user.click(
      screen.getByRole("button", { name: /actualizar contrase/i }),
    );

    expect(
      await screen.findByText(/no coinciden/i),
    ).toBeInTheDocument();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("envia ambas contrasenas como FormData", async () => {
    const user = userEvent.setup();
    render(<ResetForm />);

    await user.type(screen.getByLabelText(/nueva contrase/i), "secret123");
    await user.type(screen.getByLabelText(/confirmar contrase/i), "secret123");
    await user.click(
      screen.getByRole("button", { name: /actualizar contrase/i }),
    );

    await waitFor(() => expect(resetPasswordMock).toHaveBeenCalledTimes(1));
    const formData = resetPasswordMock.mock.calls[0][0] as FormData;
    expect(formData.get("password")).toBe("secret123");
    expect(formData.get("passwordConfirm")).toBe("secret123");
  });
});
