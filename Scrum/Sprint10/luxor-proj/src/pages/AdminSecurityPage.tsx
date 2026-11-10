import { AdminLayout } from "../components/admin/AdminLayout";
import { PageMeta } from "../components/seo/PageMeta";
import { SecurityAlerts } from "../features/admin/SecurityAlerts";

// Alertas de seguridad (inicios de sesión fallidos y bloqueos) en su propia pantalla de la consola
export default function AdminSecurityPage() {
  return (
    <AdminLayout title="Seguridad">
      <PageMeta title="Seguridad" noindex />
      <SecurityAlerts />
    </AdminLayout>
  );
}
