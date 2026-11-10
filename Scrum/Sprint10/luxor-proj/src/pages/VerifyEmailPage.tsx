import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { PageTitle, Text } from "../components/ui/Typography";
import { PageMeta } from "../components/seo/PageMeta";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { verifyEmail } from "../services/emailVerificationService";
import { EmailVerificationNotice } from "../components/auth/EmailVerificationNotice";

// Página a la que lleva el enlace del correo de verificación: /verificar-correo?token=...
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { user, refreshSession } = useAuth();
  // sin token en el enlace no hay nada que preguntar al backend
  const [resultado, setResultado] = useState<{ ok: boolean; message: string } | null>(() =>
    token ? null : { ok: false, message: "El enlace no trae el código de verificación." }
  );
  const pedido = useRef(false);

  useEffect(() => {
    // una sola vez aunque React monte la página dos veces en desarrollo (el token sirve una vez)
    if (pedido.current || !token) return;
    pedido.current = true;
    void verifyEmail(token).then((r) => {
      setResultado(r);
      if (r.ok) refreshSession();
    });
  }, [token, refreshSession]);

  return (
    <MainLayout>
      <PageMeta title="Confirmar correo" noindex />
      <Section className="min-h-[60vh]">
        <Container>
          <div className="max-w-xl mx-auto flex flex-col gap-6 text-center">
            <PageTitle>Confirmar correo</PageTitle>
            {!resultado ? (
              <LoadingSpinner message="Confirmando tu correo..." />
            ) : resultado.ok ? (
              <>
                <p className="text-lg text-status-success font-bold" role="status">{resultado.message}</p>
                <Text className="text-primary-champagne/70">Ya puedes comprar con tu cuenta.</Text>
                <Link to="/perfumes" className="self-center rounded-full bg-primary-gold px-8 py-3 text-xs font-black uppercase tracking-widest text-primary-black">
                  Ver perfumes
                </Link>
              </>
            ) : (
              <>
                <p className="text-lg text-status-error font-bold" role="alert">{resultado.message}</p>
                {user ? (
                  <EmailVerificationNotice className="text-left" />
                ) : (
                  <Text className="text-primary-champagne/70">
                    <Link to="/login" className="text-primary-gold underline">Inicia sesión</Link> y pide un enlace nuevo
                    desde Mi cuenta.
                  </Text>
                )}
              </>
            )}
          </div>
        </Container>
      </Section>
    </MainLayout>
  );
}
