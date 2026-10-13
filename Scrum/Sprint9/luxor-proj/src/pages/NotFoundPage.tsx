import { MainLayout } from "../components/layout/MainLayout";
import { NotFoundMessage } from "../components/ui/NotFoundMessage";
import { PageMeta } from "../components/seo/PageMeta";

// SFTWRKEY-423: cualquier URL que no existe cae aquí (ruta "*" en App.tsx)
export default function NotFoundPage() {
  return (
    <MainLayout>
      <PageMeta title="Página no encontrada" noindex />
      <NotFoundMessage
        title="Esta página no existe"
        message="Puede que el enlace esté mal escrito o que la página se haya movido. Te invitamos a seguir explorando nuestras fragancias."
      />
    </MainLayout>
  );
}
