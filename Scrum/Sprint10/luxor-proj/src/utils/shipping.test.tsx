// SFTWRKEY-449: envío en el navegador (la misma regla que el backend) y forma de entrega en el pago
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { describeDelivery, shippingFor, shippingLabel } from "./shipping";
import { PaymentForm } from "../validation/PaymentForm";

describe("shippingFor", () => {
  it("Q35 por debajo de Q500, gratis desde Q500 y al recoger en tienda", () => {
    expect(shippingFor(499.99, "envio")).toBe(35);
    expect(shippingFor(500, "envio")).toBe(0);
    expect(shippingFor(120, "recoger")).toBe(0);
    expect(shippingLabel(35)).toBe("Q35.00");
    expect(shippingLabel(0)).toBe("Gratis");
  });

  it("describe la entrega para el cliente y el admin", () => {
    expect(describeDelivery({ method: "recoger", store: { id: "luxor", name: "Joyería Luxor", address: "C.C. San Isidro, Zona 16" } }))
      .toBe("Recoger en Joyería Luxor, C.C. San Isidro, Zona 16");
    expect(describeDelivery(null)).toBeNull();
  });
});

describe("PaymentForm con forma de entrega", () => {
  const abrir = () => {
    const onValidSubmit = vi.fn();
    const onDeliveryMethodChange = vi.fn();
    render(
      <MemoryRouter>
        <PaymentForm isProcessing={false} onValidSubmit={onValidSubmit} onDeliveryMethodChange={onDeliveryMethodChange} />
      </MemoryRouter>
    );
    return { onValidSubmit, onDeliveryMethodChange, user: userEvent.setup() };
  };

  it("al recoger en tienda oculta la dirección y solo pide el local", async () => {
    const { onValidSubmit, onDeliveryMethodChange, user } = abrir();
    expect(screen.getByLabelText("Dirección de envío")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /recoger en tienda/i }));
    expect(onDeliveryMethodChange).toHaveBeenCalledWith("recoger");
    expect(screen.queryByLabelText("Dirección de envío")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Local"), "glamour");
    await user.click(screen.getByRole("button", { name: /continuar al pago seguro/i }));

    expect(onValidSubmit).toHaveBeenCalledWith(expect.objectContaining({ deliveryMethod: "recoger", pickupStore: "glamour" }));
  });

  it("sin elegir local no deja continuar", async () => {
    const { onValidSubmit, user } = abrir();
    await user.click(screen.getByRole("radio", { name: /recoger en tienda/i }));
    await user.click(screen.getByRole("button", { name: /continuar al pago seguro/i }));
    expect(onValidSubmit).not.toHaveBeenCalled();
  });
});
