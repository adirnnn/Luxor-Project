// Menú de la cuenta de la barra: opciones según el rol y manejo con teclado
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AccountMenu } from "./AccountMenu";

const abrirMenu = (isAdmin: boolean, onLogout = vi.fn()) => {
  render(
    <MemoryRouter>
      <AccountMenu name="Ana López" isAdmin={isAdmin} onLogout={onLogout} />
    </MemoryRouter>
  );
  return screen.getByRole("button", { name: /menú de la cuenta/i });
};

describe("AccountMenu", () => {
  it("empieza cerrado y muestra solo el primer nombre", () => {
    const boton = abrirMenu(false);
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(boton).toHaveTextContent("Ana");
    expect(screen.queryByRole("link", { name: "Mi cuenta" })).not.toBeInTheDocument();
  });

  it("un cliente ve su cuenta y favoritos, pero no las opciones de admin", async () => {
    await userEvent.click(abrirMenu(false));
    expect(screen.getByRole("link", { name: "Mi cuenta" })).toHaveAttribute("href", "/mi-cuenta");
    expect(screen.getByRole("link", { name: "Favoritos" })).toHaveAttribute("href", "/lista-de-deseos");
    expect(screen.queryByRole("link", { name: "Panel" })).not.toBeInTheDocument();
    expect(screen.queryByText("Administración")).not.toBeInTheDocument();
  });

  it("un admin además ve Panel, Pedidos y Reporte", async () => {
    await userEvent.click(abrirMenu(true));
    expect(screen.getByRole("link", { name: "Panel" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: "Pedidos" })).toHaveAttribute("href", "/admin/pedidos");
    expect(screen.getByRole("link", { name: "Reporte" })).toHaveAttribute("href", "/reporte");
  });

  it("se abre con Enter, se cierra con Escape y el foco vuelve al botón", async () => {
    const boton = abrirMenu(true);
    boton.focus();
    await userEvent.keyboard("{Enter}");
    expect(boton).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(boton).toHaveFocus();
  });

  it("Salir cierra la sesión", async () => {
    const onLogout = vi.fn();
    await userEvent.click(abrirMenu(false, onLogout));
    await userEvent.click(screen.getByRole("button", { name: "Salir" }));
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
