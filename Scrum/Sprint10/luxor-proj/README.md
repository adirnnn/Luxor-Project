# Perfumería Victoria

Tienda en línea de perfumes árabes y de diseñador. Incluye catálogo con búsqueda por notas olfativas, carrito, compra con o sin cuenta, seguimiento de pedidos, asistente virtual, panel de administración con reportes y carga masiva de inventario.

Sitio en producción: https://luxor-project-green.vercel.app

## Características

**Clientes**
- Catálogo con búsqueda por nombre, marca, categoría o nota olfativa, y ficha de cada perfume.
- Carrito persistente para usuarios con sesión.
- Compra con cuenta o como invitado, con pago en la página segura de Recurrente (ver [Pagos](#pagos)).
- Registro e inicio de sesión con correo y contraseña, o con Google (requiere configurar el id de cliente de Google, ver [Despliegue](#despliegue)).
- **Mi cuenta:** perfil, cambio de contraseña e historial de pedidos con su estado.
- Asistente virtual (chatbot) que responde dudas de la tienda y recomienda perfumes.
- Páginas de privacidad, términos y condiciones, envíos y devoluciones, y preguntas frecuentes.

**Administración**
- Alta, edición y baja de perfumes; importación masiva por CSV con validación por fila e historial.
- Búsqueda en PerfumAPI para importar fichas de perfumes externos.
- Gestión de pedidos con filtros por estado y fecha, detalle e historial: `pagado → en preparación → enviado → entregado` o `cancelado` (al cancelar, el stock regresa al inventario).
- Reporte con métricas y gráficas (ventas por mes y categoría, productos más vendidos, inventario).
- Alertas de seguridad (intentos de inicio de sesión fallidos y bloqueos) y aviso de pedidos nuevos.

**SEO y redes sociales**
- Título y descripción propios en cada página; las páginas privadas llevan `noindex`.
- Vista previa con imagen al compartir el sitio o un perfume en WhatsApp, Facebook o X.
- `robots.txt` y `sitemap.xml` generado con el catálogo actual.

## Tecnologías

| Parte | Tecnologías |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Framer Motion. Pruebas con Vitest y React Testing Library |
| Funciones de Vercel | `api/product-preview.ts` (vista previa para redes) y `api/sitemap.ts` |
| Backend | Node.js, Express, PostgreSQL, JWT, bcrypt, Helmet. Pruebas con `node --test` |
| Chatbot | Python, FastAPI. LLM local con Ollama en desarrollo y Groq (API compatible con OpenAI) en producción. Pruebas con pytest |
| Infraestructura | Docker Compose en local; Vercel (frontend) y Render (backend, chatbot y PostgreSQL) en producción; GitHub Actions |

## Estructura

```
luxor-proj/
├── src/                    # frontend (páginas, componentes, servicios, pruebas *.test.tsx)
├── api/                    # funciones de Vercel (vista previa para redes y sitemap)
├── public/                 # imágenes, fuentes, robots.txt, og-image.jpg
├── backend/                # API Express (server.js, commerce.js, routes/, services/, seed.js)
│   ├── integration-tests/  # pruebas contra una base PostgreSQL real
│   └── chatbot/            # servicio FastAPI del asistente virtual
├── e2e/                    # pruebas de extremo a extremo con Playwright (playwright.config.ts)
├── docs/                   # CSV, PerfumAPI, colección de Postman y seguridad (matriz OWASP)
├── performance/k6/         # pruebas de carga, estrés y picos
├── docker-compose.yml
├── vercel.json             # build, rewrites y cabeceras de seguridad del frontend
└── render.yaml             # copia de referencia del blueprint (Render usa el de la raíz del repo)
```

## Inicio rápido con Docker

1. Copia `.env.example` a `.env` en esta carpeta y completa los valores. El archivo `.env` está en `.gitignore`; nunca lo subas al repositorio.

   Mínimo para levantar todo en local:

   ```env
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=una_contrasena_local
   POSTGRES_DB=habibi_parfums
   POSTGRES_HOST=db
   POSTGRES_PORT=5432
   FRONTEND_URL=http://localhost:5173
   # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   JWT_SECRET=un_valor_aleatorio_largo
   CHATBOT_INTERNAL_KEY=otro_valor_aleatorio_largo
   RECURRENTE_SECRET_KEY=sk_test_...   # llave del Sandbox de Recurrente
   PERFUM_API_BASE_URL=https://perfumapidatabase.onrender.com
   ```

   `.env.example` documenta el resto (Google, umbrales de alertas, proveedor del LLM).

2. Levanta los servicios:

   ```bash
   docker compose up --build
   ```

3. Abre `http://localhost:5173`. El backend queda en `http://localhost:3000`, el chatbot en `http://localhost:8000` y PostgreSQL en el puerto `5433` del equipo. Al iniciar, el backend ejecuta `seed.js`, que crea las tablas y el catálogo inicial.

Para el chatbot en local se necesita [Ollama](https://ollama.com) en el equipo anfitrión:

```bash
ollama pull qwen3:4b
ollama serve
```

## Desarrollo sin Docker

```bash
# frontend
npm ci
npm run dev

# backend (otra terminal)
cd backend
npm ci
npm run seed
npm run dev
```

El navegador llama al backend por `/api` en el mismo dominio del sitio (así la cookie de sesión no es de otro sitio). En local lo reenvía el proxy de `vite.config.ts` a `http://localhost:3000`; para usar otro backend define `BACKEND_URL` al levantar Vite (por ejemplo `BACKEND_URL=http://localhost:3100 npm run dev`).

## Pruebas

| Qué | Comando | Dónde |
| --- | --- | --- |
| Frontend (Vitest) | `npm run test:run` | esta carpeta |
| Frontend con cobertura | `npm run test:coverage` | esta carpeta |
| Build de producción | `npm run build` | esta carpeta |
| Backend (unitarias) | `npm test` | `backend/` |
| Backend contra PostgreSQL real | `npm run test:db:up`, `npm run test:db:seed`, `npm run test:integration`, `npm run test:regression`, `npm run test:db:down` | `backend/` (requiere Docker) |
| Chatbot (pytest) | `pip install -r requirements-dev.txt` y luego `pytest` | `backend/chatbot/` |
| De extremo a extremo (Playwright) | ver abajo | esta carpeta (requiere Docker) |
| Carga (k6) | `k6 run performance/k6/load-test.js` | esta carpeta |

GitHub Actions corre las pruebas del frontend, el backend y el chatbot, más el build, en cada push o pull request a `main` (`.github/workflows/tests.yml`), las de integración y regresión cuando cambia el backend (`.github/workflows/integration-regression.yml`) y las de extremo a extremo en cada cambio del proyecto (`.github/workflows/e2e.yml`). Los detalles de las de integración están en [backend/integration-tests/README.md](backend/integration-tests/README.md).

### Pruebas de extremo a extremo (Playwright)

Un navegador real recorre el sitio como lo haría una persona, contra el backend y una base PostgreSQL de prueba. Están en `e2e/` y cubren los cuatro flujos críticos y la sesión:

| Archivo | Flujo |
| --- | --- |
| `e2e/registro-login.spec.ts` | El admin registra un cliente desde su panel, el cliente no entra con una contraseña equivocada, entra con la suya, ve sus datos en Mi cuenta y cierra sesión |
| `e2e/compra.spec.ts` | Un cliente agrega un perfume, paga en Recurrente (simulado por `e2e/recurrente-simulado.mjs`), ve la confirmación y el pedido aparece en Mi cuenta como pagado; si la tarjeta se rechaza y se sale, no hay pedido y el carrito sigue igual |
| `e2e/invitado.spec.ts` | Un visitante sin cuenta compra como invitado y recibe su número de pedido |
| `e2e/admin-estado.spec.ts` | El admin abre un pedido en el panel, lo pasa a "En preparación" y luego a "Enviado", y el cliente ve el estado nuevo |
| `e2e/sesion.spec.ts` | La sesión queda en una cookie `httpOnly` que JavaScript no puede leer, sigue al recargar y se borra al salir. Corre en Chromium, Firefox y WebKit (el motor de Safari) |

Para correrlas en local (desde esta carpeta):

```bash
# 1. base de pruebas (la misma de las pruebas de integración)
cd backend && npm run test:db:up && npm run test:db:seed && cd ..

# 2. la primera vez, los navegadores de Playwright
npx playwright install chromium firefox webkit

# 3. las pruebas
npm run test:e2e
```

Playwright levanta solo el backend (puerto 3100) contra esa base y un build del frontend (puerto 4180), que llama al backend por `/api` igual que en producción, así que no hace falta tener nada corriendo; usa puertos propios para no tocar por error un backend que esté apuntando a otra base. Antes de los flujos crea el perfume `e2e-perfume` con stock de sobra, para no gastar el stock de los perfumes reales. Los correos no se envían (`RESEND_API_KEY` va vacía) y cada corrida usa correos nuevos, así que se pueden repetir sin limpiar la base. Para ver el navegador mientras corren: `npx playwright test --headed`. Si algo falla en el CI, el reporte con capturas y la traza queda como artefacto del workflow.

## Seguridad

- Contraseñas con bcrypt (12 rondas) y sesiones con JWT firmado (HS256, 8 horas) guardado en una cookie `HttpOnly`, `SameSite=Lax` y `Secure`: el JavaScript de la página no puede leerlo. Las peticiones que cambian datos desde otro origen se rechazan (CSRF).
- Autorización en el backend (`backend/services/auth.js`): cada usuario solo accede a sus propios datos; reportes, inventario, importaciones y pedidos son solo para `ADMIN`. El frontend además protege las rutas por rol.
- Límite de intentos en el inicio de sesión, el cambio de contraseña y el checkout de invitado, con alertas para el administrador.
- El total de cada compra se recalcula en el servidor con los precios de la base de datos.
- SQL siempre parametrizado, cabeceras de seguridad (Helmet en la API; CSP, HSTS y demás en `vercel.json`) y CORS restringido al dominio del frontend.
- La revisión completa está en la [matriz OWASP](docs/security/MATRIZ_OWASP.md) y en el [informe de seguridad](docs/security/INFORME_SEGURIDAD_SPRINT8.md), con los reportes de OWASP ZAP y de auditoría de dependencias en `docs/security/anexos/`.

## Pagos

Los pagos van con [Recurrente](https://recurrente.com). El cliente paga en la página de Recurrente, así que el número de tarjeta nunca llega a nuestro servidor (solo guardamos la marca y los últimos 4 dígitos que Recurrente devuelve).

1. Al pulsar "Continuar al pago seguro", el backend recalcula el total con los precios de la base, aparta el stock por 30 minutos y crea el checkout en Recurrente (`backend/services/checkoutSessions.js` y `paymentGateway.js`).
2. El cliente paga y Recurrente lo regresa a `/pago/resultado`, donde el backend le pregunta a Recurrente si el cobro quedó aprobado. Solo entonces se crea el pedido `pagado`, se registra el pago y se manda el correo.
3. Si el cliente se sale (`/pago/cancelado`) o cierra la pestaña, el stock regresa y no se crea ningún pedido. El backend revisa los pagos vencidos cada 5 minutos.
4. Si el cliente paga y cierra la página antes de volver, Recurrente avisa por webhook a `POST /webhooks/recurrente` (`backend/routes/paymentWebhooks.js`). Se verifica la firma con `RECURRENTE_WEBHOOK_SECRET` (sin firma válida responde 401), se le vuelve a preguntar a Recurrente si está pagado y se crea el pedido por el mismo camino que el paso 2. Un aviso repetido no crea otro pedido ni descuenta stock dos veces, y cada aviso queda en la tabla `payment_webhook_events`.

La llave va en `RECURRENTE_SECRET_KEY`: `sk_test_...` de un Sandbox para probar (tarjeta `4242 4242 4242 4242` aprobada, `4000 0000 0000 0002` rechazada) y `sk_live_...` en Render para cobrar de verdad. Las pruebas automáticas nunca llaman a Recurrente: lo simulan.

## Importación CSV

En el panel de administración, **Importar CSV** permite descargar la plantilla, cargar el archivo, revisar filas aceptadas y rechazadas, y ver el historial. Encabezados, en este orden:

```csv
id,name,price,image,description,stock,salida,corazon,fondo
```

`id`, `name`, `price` y `stock` son obligatorios; `id` solo admite letras, números y guiones. Especificación completa en [docs/CSV_IMPORT.md](docs/CSV_IMPORT.md). La integración con PerfumAPI está en [docs/PERFUM_API.md](docs/PERFUM_API.md) y la colección de Postman de la API en `docs/postman/`.

## Rutas del sitio

| Ruta | Descripción | Acceso |
| --- | --- | --- |
| `/` | Inicio | Público |
| `/perfumes` | Catálogo | Público |
| `/producto/:id` | Ficha del perfume | Público |
| `/cart` | Carrito | Público |
| `/pago` | Checkout | Público (con cuenta o como invitado) |
| `/pago/resultado` | Vuelta desde Recurrente: confirma el pago y muestra el pedido | Público (con la referencia del pago) |
| `/pago/cancelado` | Vuelta desde Recurrente cuando no se pagó: libera el stock | Público (con la referencia del pago) |
| `/login` | Inicio de sesión y registro | Público |
| `/mi-cuenta` | Perfil, contraseña y pedidos | Con sesión |
| `/privacidad`, `/terminos`, `/envios-devoluciones`, `/preguntas-frecuentes` | Información legal y ayuda | Público |
| `/admin` | Panel de inventario | ADMIN |
| `/admin/nuevo`, `/admin/editar/:id` | Alta y edición de perfumes | ADMIN |
| `/admin/nuevo-usuario` | Registro de clientes | ADMIN |
| `/admin/importar` | Importación CSV | ADMIN |
| `/admin/pedidos` | Pedidos: filtros, detalle, historial y cambio de estado | ADMIN |
| `/reporte` | Reportes y métricas | ADMIN |

## Despliegue

| Componente | Proveedor | URL |
| --- | --- | --- |
| Frontend y funciones `api/` | Vercel (root directory `Scrum/Sprint10/luxor-proj`) | https://luxor-project-green.vercel.app |
| Backend (Express) | Render, servicio Docker `luxor-backend` | https://luxor-backend-9ov9.onrender.com |
| Chatbot (FastAPI) | Render, servicio Docker `luxor-chatbot` | https://luxor-chatbot.onrender.com |
| Base de datos | PostgreSQL en Render (`luxor-db`) | host interno |

- **Vercel** redepliega en cada push a `main`. El rewrite `/api/:path*` de `vercel.json` reenvía las llamadas del sitio al backend de Render. Variables: `VITE_CHATBOT_URL` y `VITE_API_URL` (esta última solo la usan las funciones de `api/`).
- **Render** usa el blueprint `render.yaml` de la raíz del repositorio (servicios, base de datos y variables). Render genera `JWT_SECRET` y `CHATBOT_INTERNAL_KEY`; `LLM_API_KEY` (Groq) se carga a mano en el panel y no viaja en el repositorio.
- **Inicio de sesión con Google:** crear un id de cliente OAuth en Google Cloud (origen autorizado: el dominio del frontend) y cargarlo como `VITE_GOOGLE_CLIENT_ID` en Vercel y `GOOGLE_CLIENT_ID` en `luxor-backend` (Render). Sin esas variables el botón de Google no aparece y el resto del sitio funciona igual.
- La base de datos del plan gratuito de Render vence a los 30 días; la actual vence el **6 de noviembre de 2026**. Al recrearla, el seed vuelve a crear las tablas y el catálogo inicial.
- Si el sitio cambia de dominio, actualizar `FRONTEND_URL` y `CHATBOT_ALLOWED_ORIGINS` en `render.yaml`, y las URL absolutas de `index.html` (etiquetas `og:`) y `public/robots.txt`.

## Equipo

Dally Ramirez · Denis Roberto Rodríguez Jiménez · Diego Sandoval · Javier Chávez · Adrián López

Los registros de tiempo (LOGT) del equipo están en [`LOGT/`](LOGT/).
