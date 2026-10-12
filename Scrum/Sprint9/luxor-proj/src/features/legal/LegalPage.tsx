// SFTWRKEY-434: plantilla compartida de las páginas legales (privacidad, términos, envíos).
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import clsx from "clsx";
import { MainLayout } from "../../components/layout/MainLayout";
import { Container } from "../../components/ui/Container";
import { PageTitle } from "../../components/ui/Typography";
import { PageMeta } from "../../components/seo/PageMeta";
import { LEGAL_LINKS } from "./legalLinks";

const ULTIMA_ACTUALIZACION = "10 de octubre de 2026";

export type LegalSection = {
  title: string;
  content: ReactNode;
};

type Props = {
  title: string;
  // SFTWRKEY-435: descripción para buscadores
  description: string;
  intro: ReactNode;
  sections: LegalSection[];
};

export const LegalPage = ({ title, description, intro, sections }: Props) => (
  <MainLayout>
    <PageMeta title={title} description={description} />
    <Container className="max-w-3xl">
      <nav aria-label="Ayuda e información legal" className="mb-10 flex flex-wrap gap-x-6 gap-y-3">
        {LEGAL_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              clsx(
                "text-[11px] font-bold uppercase tracking-[0.2em] transition-colors",
                isActive ? "text-primary-gold" : "text-primary-champagne/40 hover:text-primary-champagne"
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <PageTitle className="mb-4">{title}</PageTitle>
      <p className="mb-10 text-xs uppercase tracking-[0.2em] text-primary-champagne/40">
        Última actualización: {ULTIMA_ACTUALIZACION}
      </p>

      <div className="mb-12 text-base leading-relaxed text-primary-champagne/70 md:text-lg">{intro}</div>

      <div className="flex flex-col gap-10">
        {sections.map((section, index) => (
          <section key={section.title} aria-labelledby={`legal-${index}`}>
            <h2
              id={`legal-${index}`}
              className="mb-4 font-heading text-lg uppercase tracking-widest text-primary-gold md:text-xl"
            >
              {index + 1}. {section.title}
            </h2>
            <div className="flex flex-col gap-3 text-base leading-relaxed text-primary-champagne/70">
              {section.content}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-16 border-t border-white/10 pt-8 text-sm text-primary-champagne/50">
        ¿Dudas? Escríbenos por{" "}
        <a
          href="https://wa.me/50247143882"
          target="_blank"
          rel="noreferrer"
          className="text-primary-gold underline-offset-4 hover:underline"
        >
          WhatsApp al +502 4714 3882
        </a>{" "}
        o visita uno de nuestros locales. <Link to="/" className="text-primary-gold underline-offset-4 hover:underline">Volver al inicio</Link>
      </p>
    </Container>
  </MainLayout>
);
