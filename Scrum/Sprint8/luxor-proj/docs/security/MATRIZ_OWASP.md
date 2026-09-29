# Matriz de riesgos OWASP Top 10 — Perfumería Victoria

**Marco:** OWASP Top 10 (2025) · **Última actualización:** 27/09/2026

Documento vivo del Sprint 8. Se actualiza cada vez que se termina una tarea de seguridad y al cierre se exporta a PDF como anexo del informe.

## Cómo leer y actualizar la matriz

| Columna | Valores |
|---|---|
| **Resultado** | `Pasa` = el control existe y funciona · `Falla` = hay un riesgo confirmado · `Pendiente` = todavía no se evalúa |
| **Método** | `RC` = revisión de código (27/09/2026, base del Sprint 8) · `PA` = prueba automática · `PM` = prueba manual · `ZAP` = escaneo OWASP ZAP · `AUD` = auditoría de dependencias |
| **Severidad** | `Crítica` = control de cuentas ADMIN o datos de cualquier usuario, sin autenticarse · `Alta` = expone datos personales, permite fraude o una denegación de servicio sencilla · `Media` = impacto limitado o requiere condiciones extra · `Baja` = buena práctica |
| **Estado** | `Abierto` · `Corregido` · `Verificado` (corregido y con prueba que lo confirma) · `Aceptado` (riesgo asumido y justificado) |

**Al terminar una tarea de seguridad:**
1. Cambiar **Resultado**, **Método** y **Estado** de las filas de esa tarea.
2. Si la corrección tiene una prueba automática, anotar su nombre en **Prueba**.
3. Actualizar el resumen de abajo.

Los resultados marcados `RC` salen solo de la lectura del código. Cada uno se confirma con la prueba de su ticket antes de pasar a `Verificado`.

## Resumen por categoría

| Categoría | Filas | Pasa | Falla | Pendiente |
|---|---|---|---|---|
| A01 Pérdida de control de acceso | 6 | 5 | 0 | 1 |
| A02 Configuración de seguridad incorrecta | 9 | 1 | 8 | 0 |
| A03 Cadena de suministro de software | 2 | 0 | 0 | 2 |
| A04 Fallas criptográficas | 3 | 3 | 0 | 0 |
| A05 Inyección | 6 | 5 | 0 | 1 |
| A06 Diseño inseguro | 4 | 2 | 1 | 1 |
| A07 Fallas de autenticación | 7 | 1 | 5 | 1 |
| A08 Integridad de software y datos | 3 | 2 | 1 | 0 |
| A09 Registro y alertas | 2 | 1 | 1 | 0 |
| A10 Condiciones excepcionales | 3 | 1 | 1 | 1 |
| **Total** | **45** | **21** | **17** | **7** |

**Riesgos abiertos (Falla + Abierto) por severidad:** 1 Crítica · 3 Altas · 8 Medias · 4 Bajas. SEC-35 está en `Falla` pero como riesgo `Aceptado`.

## Matriz

| ID | Cat. | Componente | Endpoint / archivo | Riesgo | Prueba | Resultado | Método | Severidad | Ticket | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| SEC-01 | A01 | Backend | `GET/PUT /user/:userId`, `GET /user/:userId/orders`, `PUT /user/:userId/password` | Un cliente lee o modifica el perfil, pedidos o contraseña de otro usuario (IDOR) | IDOR: cliente 7 contra `/user/999`, `/user/999/orders` y `/user/999/password` → 403; ids alterados (`/user/07`, `/user/7abc`, `/user/%207`) → 403; `PUT /user/7` ignora `role` e `id` del body (`security.accessControl.test.js`, `authorization.test.js`) | Pasa | PA | Alta | SFTWRKEY-378 | Verificado |
| SEC-02 | A01 | Backend | `GET/POST /cart/:userId`, `POST /checkout/:userId` | Un cliente ve o altera el carrito de otro, o compra a su nombre | Cliente 7 contra `/cart/999` (GET/POST) y `/checkout/999` → 403; ids alterados (`/cart/7.0`, `/cart/-7`) → 403; un VENDEDOR tampoco accede → 403 (`security.accessControl.test.js`, `authorization.test.js`) | Pasa | PA | Alta | SFTWRKEY-378 | Verificado |
| SEC-03 | A01 | Backend | `POST/PUT/DELETE /products`, `/report*`, `/users/search`, `/imports/*`, `/external-perfumes/*`, `/admin/perfum-sync-logs` | Un CLIENTE usa funciones de administrador | CLIENTE y VENDEDOR contra productos, `/report/*` (las 6 rutas), `/users/search`, `/imports/*` (incluida la plantilla) y `/external-perfumes/*` → 403 sin consultar la BD; `/register` siempre crea CLIENTE (`security.accessControl.test.js`, `authorization.test.js`) | Pasa | PA | Crítica | SFTWRKEY-378 | Verificado |
| SEC-04 | A01 | Backend | `services/auth.js` (`authenticate`) | Acceso con un token ausente, vencido, firmado con otro secreto o con un esquema distinto de `Bearer` | Sin token, token alterado, firmado con otra clave, vencido, `alg: none`, rol cambiado en el payload, esquemas `Basic`/`Token`/`Bearer` vacío → 401 (`security.accessControl.test.js`, `authorization.test.js`) | Pasa | PA | Crítica | SFTWRKEY-378 | Verificado |
| SEC-05 | A01 | Frontend | Páginas `/admin*`, `/reporte` | La interfaz de admin se muestra a un cliente (el control real está en el backend) | Entrar como CLIENTE y abrir cada ruta; ninguna llamada de admin responde 200 | Pendiente | — | Baja | SFTWRKEY-378 | Abierto |
| SEC-06 | A02 | Backend | `server.js` | Faltan cabeceras de seguridad (HSTS, nosniff, frameguard) y se expone `X-Powered-By` | Revisar las cabeceras de `GET /products` | Falla | RC | Media | SFTWRKEY-380 | Abierto |
| SEC-07 | A02 | Backend | `server.js`, `services/rateLimit.js` | Sin `trust proxy`, en Render todas las peticiones comparten la IP del proxy: el rate limit bloquea a todos a la vez y no identifica al atacante | 11 logins desde IPs distintas (`X-Forwarded-For`) → solo se bloquea la IP que abusa | Falla | RC | Alta | SFTWRKEY-380 | Abierto |
| SEC-08 | A02 | Backend | `POST /chatbot/queries` | Endpoint público que escribe en la BD: cualquiera puede llenar la tabla `chatbot_queries` | Sin la cabecera interna → 401 | Falla | RC | Alta | SFTWRKEY-380 | Abierto |
| SEC-09 | A02 | Chatbot | `POST /chat/test-log` (`app/bot/router.py`) | Endpoint de prueba expuesto en producción que genera registros falsos | La ruta ya no existe → 404 | Falla | RC | Media | SFTWRKEY-380 | Abierto |
| SEC-10 | A02 | Backend | `POST /imports/products` (catch) | Se devuelve `err.message` de cualquier error, incluidos los internos de la BD | Forzar un error de BD → mensaje genérico | Falla | RC | Media | SFTWRKEY-380 | Abierto |
| SEC-11 | A02 | Frontend | `vercel.json` | Sin CSP, `X-Frame-Options` ni HSTS en el sitio (clickjacking, impacto mayor de un XSS) | securityheaders.com sobre la URL de Vercel | Falla | RC | Media | SFTWRKEY-380 | Abierto |
| SEC-12 | A02 | Infraestructura | `backend/Dockerfile` | El contenedor corre como `root` y usa `npm install`, que instala dependencias de desarrollo en producción | Revisar el Dockerfile y ejecutar `whoami` en el contenedor | Falla | RC | Baja | SFTWRKEY-380 | Abierto |
| SEC-13 | A02 | Chatbot | `app/main.py` (CORS) | CORS con `allow_credentials=True` y métodos y cabeceras `*`, más permisivo de lo necesario | Revisar la configuración | Falla | RC | Baja | SFTWRKEY-380 | Abierto |
| SEC-14 | A02 | Backend | `server.js` (CORS) | Otros orígenes llaman a la API desde el navegador | `Origin` distinto de `FRONTEND_URL` → sin cabecera CORS | Pasa | RC | Media | SFTWRKEY-380 | Abierto |
| SEC-15 | A03 | Frontend / Backend | `package.json`, `backend/package.json` | Dependencias npm con vulnerabilidades conocidas | `npm audit --audit-level=high --omit=dev` | Pendiente | — | Media | SFTWRKEY-382 | Abierto |
| SEC-16 | A03 | Chatbot | `backend/chatbot/requirements.txt` | Dependencias pip con vulnerabilidades conocidas | `pip-audit -r requirements.txt` | Pendiente | — | Media | SFTWRKEY-382 | Abierto |
| SEC-17 | A04 | Backend | `services/authHandlers.js` | Contraseñas guardadas en claro o con un hash débil | bcrypt con 12 rondas en registro y cambio de contraseña | Pasa | RC | Crítica | SFTWRKEY-381 | Abierto |
| SEC-18 | A04 | Backend | `services/auth.js` | Tokens JWT falsificables (secreto débil o `alg: none`) | HS256 con `JWT_SECRET` generado por Render, 8 h de validez; un token `alg: none` → 401 | Pasa | RC | Crítica | SFTWRKEY-381 | Abierto |
| SEC-19 | A04 | Infraestructura | Vercel, Render | Tráfico sin cifrar | Todo el tráfico es HTTPS (lo gestiona cada proveedor) | Pasa | RC | Alta | SFTWRKEY-380 | Abierto |
| SEC-20 | A05 | Backend | Todo el SQL de `server.js` y `services/` | Inyección SQL | 6 payloads (`' OR '1'='1`, `DROP TABLE`, `UNION SELECT`, `pg_sleep`…) contra `/products/search`, `/login`, `/users/search` y `/products/:id`: viajan como parámetro y nunca en el texto SQL (`security.injection.test.js`). Búsqueda de SQL con `${}` interpolado: 0 coincidencias | Pasa | PA | Crítica | SFTWRKEY-379 | Verificado |
| SEC-21 | A05 | Frontend | Catálogo, detalle, carrito, admin, chatbot | XSS almacenado desde nombre o descripción del producto, CSV o respuestas del bot | `<script>` e `<img onerror>` en nombre, descripción y notas de `ProductCard` y `ProductDetail`, y en una respuesta del chatbot: se muestran como texto, sin crear elementos ni ejecutar código (`src/test/xss.test.tsx`). No hay `dangerouslySetInnerHTML` | Pasa | PA | Alta | SFTWRKEY-379 | Verificado |
| SEC-22 | A05 | Backend | `POST/PUT /products`, `csvImport.js` (campo `image`) | `image` acepta cualquier cadena (`javascript:`, `data:`, `http:`) | `javascript:`, `data:`, `http:`, `//host`, rutas sin `/` y más de 500 caracteres → 400 en POST y PUT, y error de fila en el CSV. Vacío, `/ruta` y `https://` → aceptados. Se corrigió con `services/imageValidation.js` (`security.injection.test.js`) | Pasa | PA | Baja | SFTWRKEY-379 | Verificado |
| SEC-23 | A05 | Backend | `PUT /products/:id` | No usa `validateProductPayload` (el POST sí): acepta tipos y longitudes inválidos | Ahora usa `validateProductPayload`: `stock: "abc"` y un nombre de 201 caracteres → 400 (`security.injection.test.js`); las pruebas anteriores del PUT siguen pasando | Pasa | PA | Media | SFTWRKEY-379 | Verificado |
| SEC-24 | A05 | Chatbot | `POST /chat` (`app/bot/models.py`, `service.py`) | Prompt injection y mensajes sin límite de tamaño (costo y abuso del LLM) | Se agregó `max_length=500` a `message` y una regla contra prompt injection al prompt final. Pruebas escritas en `tests/test_security.py` (501 caracteres → 422; la regla está en el prompt de sistema y el texto del usuario va separado); falta ejecutarlas y hacer la prueba manual con el LLM real | Pendiente | RC | Media | SFTWRKEY-379 | Corregido |
| SEC-25 | A05 | Backend | `POST /imports/products` | Inyección a través de los campos del CSV | Los valores del CSV se insertan como parámetros, y una fila con imagen `javascript:` queda marcada con error (`security.injection.test.js`) | Pasa | PA | Media | SFTWRKEY-379 | Verificado |
| SEC-26 | A06 | Backend | `POST /checkout/:userId` | El cliente manipula el precio o el total | El total se recalcula con `products.price` de la BD | Pasa | RC | Alta | SFTWRKEY-378 | Abierto |
| SEC-27 | A06 | Backend | `POST /checkout/:userId` | Sobreventa por compras simultáneas | `UPDATE ... WHERE stock >= $1` dentro de una transacción | Pasa | RC | Media | SFTWRKEY-387 | Abierto |
| SEC-28 | A06 | Backend | `POST /cart/:userId` (`validateCartItems`) | Sin tope de cantidad por producto | `quantity: 11` → 400 | Falla | RC | Baja | SFTWRKEY-391 | Abierto |
| SEC-29 | A06 | Backend | `POST /checkout/guest` (nuevo) | Abuso del checkout público: prueba de tarjetas robadas, precio manipulado, pedidos masivos | Rate limit, bloqueo tras 3 rechazos, precio de la BD | Pendiente | — | Alta | SFTWRKEY-395 | Abierto |
| SEC-30 | A07 | BD / Seed | `backend/seed.js` | `admin@luxor.com` con contraseña `123456` (publicada en el repo) se crea en cada deploy de producción | Intentar entrar en producción con esas credenciales → 401 | Falla | RC | Crítica | SFTWRKEY-381 | Abierto |
| SEC-31 | A07 | Backend | `POST /login` | Fuerza bruta: el límite de 10/min existe pero no funciona por IP en Render (ver SEC-07) | 11 intentos desde la misma IP → 429 solo para esa IP | Falla | RC | Alta | SFTWRKEY-381 | Abierto |
| SEC-32 | A07 | Backend | `POST /register` | Sin rate limit: creación masiva de cuentas | 6 registros por hora desde la misma IP → 429 | Falla | RC | Media | SFTWRKEY-381 | Abierto |
| SEC-33 | A07 | Backend / Frontend | `authHandlers.js`, `PUT /user/:id/password`, formularios | Contraseñas débiles (mínimo 6 caracteres, sin más reglas) | `"abcdefgh"` y `"12345678"` → 400 | Falla | RC | Media | SFTWRKEY-381 | Abierto |
| SEC-34 | A07 | Backend | `POST /login`, `POST /register` | Enumeración de usuarios | Login: mismo 401 y tiempo similar (`DUMMY_HASH`) con usuario inexistente o clave incorrecta. Registro: responde 409 si el correo existe | Pasa | RC | Baja | SFTWRKEY-381 | Aceptado |
| SEC-35 | A07 | Frontend | `AuthContext.tsx`, `apiClient.ts` | JWT en `localStorage`: un XSS podría robarlo | Mitigado con la CSP (SEC-11) y el escape de React (SEC-21). La migración a cookie `httpOnly` queda para un sprint futuro | Falla | RC | Media | SFTWRKEY-380 | Aceptado |
| SEC-36 | A07 | Backend | `POST /auth/google` (nuevo), `users.password` NULL | Login con Google: token no verificado, correo no verificado, o login con contraseña vacía en cuentas de Google | Token inválido → 401; `email_verified: false` → 401; cuenta de Google con clave vacía → 401 | Pendiente | — | Alta | SFTWRKEY-398 | Abierto |
| SEC-37 | A08 | Chatbot | `backend/chatbot/requirements.txt` | Dependencias sin versión fija: builds no reproducibles | Todas las dependencias con `==versión` | Falla | RC | Baja | SFTWRKEY-382 | Abierto |
| SEC-38 | A08 | CI | `.github/workflows/tests.yml`, `package-lock.json` | Instalaciones no reproducibles o sin pruebas | `npm ci` con lockfile y 3 jobs de pruebas en cada push | Pasa | RC | Baja | SFTWRKEY-382 | Abierto |
| SEC-39 | A08 | Backend | `services/perfumValidation.js`, `perfumMapper.js`, `csvImport.js` | Datos externos (PerfumAPI, CSV) guardados sin validar | Se validan URL, tipos y campos antes de guardar | Pasa | RC | Media | SFTWRKEY-379 | Abierto |
| SEC-40 | A09 | Backend | `authHandlers.js`, `rateLimit.js` | Los logins fallidos y los bloqueos no se registran ni generan alertas: un ataque pasa desapercibido | 10 logins fallidos → evento registrado y alerta al admin | Falla | RC | Media | SFTWRKEY-401 | Abierto |
| SEC-41 | A09 | Backend | `console.error` en rutas | Datos sensibles (tarjeta, contraseñas) en los logs | Ningún log imprime `req.body` (búsqueda: 0 coincidencias) | Pasa | RC | Alta | SFTWRKEY-380 | Abierto |
| SEC-42 | A10 | Backend | `server.js` (sin manejador global de errores) | Sin `NODE_ENV=production`, el manejador por defecto de Express devuelve el stack trace ante un JSON malformado u otro error no controlado | Enviar un JSON malformado → 400 genérico, sin stack | Falla | RC | Media | SFTWRKEY-380 | Abierto |
| SEC-43 | A10 | Backend | Checkout, carrito, importación CSV | Datos inconsistentes si falla una operación a la mitad | `BEGIN`/`COMMIT`/`ROLLBACK` en las tres operaciones | Pasa | RC | Alta | SFTWRKEY-378 | Abierto |
| SEC-44 | A10 | Chatbot / Backend | Pasarela de pago, PerfumAPI, proveedor del LLM | Una caída de un servicio externo produce errores 500 o respuestas colgadas | Pasarela y PerfumAPI → 502 controlado (RC). Falta probar la caída del LLM (Groq u Ollama) | Pendiente | — | Media | SFTWRKEY-379 | Abierto |
| SEC-45 | A01 | Backend | `services/auth.js` (`authorizeSelfOrRoles`) | Un token válido sin `id` autorizaba `/user/undefined`, porque `String(undefined) === "undefined"`. Se corrigió exigiendo `id` | Token sin `id` contra `/user/7` y `/user/undefined` → 403 (`security.accessControl.test.js`) | Pasa | PA | Baja | SFTWRKEY-378 | Verificado |

## Escaneo dinámico

| ID | Alcance | Prueba | Resultado | Ticket |
|---|---|---|---|---|
| ZAP-01 | Frontend (`localhost:5173`) | `zap-baseline.py` | Pendiente | SFTWRKEY-383 |
| ZAP-02 | API (`localhost:3000`) | `zap-full-scan.py` | Pendiente | SFTWRKEY-383 |

Las alertas de ZAP que no estén ya cubiertas por la matriz se agregan como filas nuevas (`SEC-45` en adelante).
