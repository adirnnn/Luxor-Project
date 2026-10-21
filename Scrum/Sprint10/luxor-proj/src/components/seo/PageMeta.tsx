// SFTWRKEY-435: título, descripción e indexación de cada página.
// React 19 sube <title> y <meta> al <head> solo, sin librerías extra.
import { SITE_NAME } from "../../seo/site";

type Props = {
  // sin título se usa el nombre de la tienda (página de inicio)
  title?: string;
  description?: string;
  // páginas privadas (admin, carrito, pago, cuenta): que los buscadores no las indexen
  noindex?: boolean;
};

export const PageMeta = ({ title, description, noindex = false }: Props) => (
  <>
    <title>{title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Perfumes árabes auténticos`}</title>
    {description && <meta name="description" content={description} />}
    {noindex && <meta name="robots" content="noindex, nofollow" />}
  </>
);
