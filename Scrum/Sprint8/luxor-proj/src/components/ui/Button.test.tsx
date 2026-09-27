import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("renderiza el contenido que recibe", () => {
    render(<Button>Comprar</Button>);
    expect(screen.getByRole("button", { name: "Comprar" })).toBeInTheDocument();
  });

  it("aplica las clases de la variante por defecto (primary)", () => {
    render(<Button>Comprar</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-primary-gold");
  });

  it("aplica las clases de una variante explicita", () => {
    render(<Button variant="outline">Ver mas</Button>);
    expect(screen.getByRole("button")).toHaveClass("border-white/10");
  });

  it("dispara onClick al hacer click", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Comprar</Button>);

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("no dispara onClick cuando esta deshabilitado", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Comprar
      </Button>
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
