import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuantitySelector } from "./QuantitySelector";

function Controlado({ inicial = 1, max = 10 }: { inicial?: number; max?: number }) {
  const [valor, setValor] = useState(inicial);
  return <QuantitySelector value={valor} max={max} onChange={setValor} />;
}

const input = () => screen.getByRole("spinbutton", { name: "Cantidad" });
const menos = () => screen.getByRole("button", { name: "Disminuir cantidad" });
const mas = () => screen.getByRole("button", { name: "Aumentar cantidad" });

describe("QuantitySelector", () => {
  it("empieza en el valor recibido y deshabilita − en el mínimo", () => {
    render(<Controlado />);
    expect(input()).toHaveValue(1);
    expect(menos()).toBeDisabled();
    expect(mas()).toBeEnabled();
  });

  it("los botones suben y bajan la cantidad y + se deshabilita en el máximo", async () => {
    const user = userEvent.setup();
    render(<Controlado max={3} />);
    await user.click(mas());
    await user.click(mas());
    expect(input()).toHaveValue(3);
    expect(mas()).toBeDisabled();
    await user.click(menos());
    expect(input()).toHaveValue(2);
  });

  it("al escribir un número mayor que el máximo se ajusta al salir del campo", async () => {
    const user = userEvent.setup();
    render(<Controlado max={10} />);
    await user.clear(input());
    await user.type(input(), "99");
    await user.tab();
    expect(input()).toHaveValue(10);
  });

  it("si se borra el número vuelve al mínimo", async () => {
    const user = userEvent.setup();
    render(<Controlado inicial={4} />);
    await user.clear(input());
    await user.tab();
    expect(input()).toHaveValue(1);
  });

  it("avisa cuando quedan pocas unidades", () => {
    render(<QuantitySelector value={1} max={3} onChange={() => {}} />);
    expect(screen.getByText("Solo quedan 3 disponibles")).toBeInTheDocument();
  });

  it("no muestra el aviso cuando hay suficientes unidades", () => {
    render(<QuantitySelector value={1} max={10} onChange={() => {}} />);
    expect(screen.queryByText(/Solo quedan/)).not.toBeInTheDocument();
  });
});
