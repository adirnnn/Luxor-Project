import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

type Props = {
  children: ReactNode;
};

export const MainLayout = ({ children }: Props) => {
  return (
    <div className="min-h-screen flex flex-col bg-primary-champagne">
      <Navbar />

      <main className="flex-1">{children}</main>

      <footer className="border-t border-primary-beige py-6 text-center text-sm text-secondary-brown">
        © {new Date().getFullYear()} Joyero Árabe
      </footer>
    </div>
  );
};