# Informe de pruebas de seguridad — Sprint 8

**Proyecto:** Perfumería Victoria (tienda en línea de perfumes) · **Marco:** OWASP Top 10 (2025) · **Fecha:** 29 de septiembre de 2026 · **Ticket:** SFTWRKEY-384

## 1. Resumen ejecutivo

Se evaluaron las 10 categorías del OWASP Top 10 sobre los tres componentes del sistema: frontend (React), API (Express + PostgreSQL) y chatbot (FastAPI + LLM). La evaluación combinó revisión de código, 138 pruebas automáticas de seguridad, dos escaneos dinámicos con OWASP ZAP y auditorías de dependencias.

| Resultado | Cantidad |
|---|---|
| Riesgos evaluados en la matriz | 45 |
| Hallazgos encontrados y corregidos durante el sprint | 20 |
| Riesgos aceptados con justificación | 2 (más 6 avisos de ZAP) |
| Riesgos abiertos | 3 (1 crítico, 2 medios), todos asignados a SFTWRKEY-381 |
| Verificaciones pendientes | 4 |
| Vulnerabilidades en dependencias | 12 → 0 (frontend), 0 (backend), 0 (chatbot) |
| Hallazgos de riesgo alto en ZAP | 0 |

**Riesgo residual:** el único riesgo crítico abierto es la cuenta de administrador de demostración con contraseña pública (`seed.js`), que todavía se crea en cada despliegue de producción. Se corrige con SFTWRKEY-381 y debe cerrarse antes de la entrega.

## 2. Alcance

| Componente | Tecnología | Entorno evaluado |
|---|---|---|
| Frontend | React 19, Vite, TypeScript | Producción (Vercel) y build local |
| API | Node.js 20, Express 5, PostgreSQL 16, JWT | Local con Docker Compose (mismo código que producción) |
| Chatbot | Python 3.12, FastAPI, LLM (Ollama o Groq) | Local con Docker y pruebas con proveedor simulado |

Los escaneos activos y las pruebas de fuerza bruta se hicieron solo en local. Contra producción solo se ejecutó el escaneo pasivo (*baseline*) de ZAP, para no cargar los servicios del plan gratuito.

## 3. Metodología

| Técnica | Herramienta | Qué aporta |
|---|---|---|
| Revisión de código | Lectura dirigida por la matriz OWASP | Encontrar riesgos antes de probarlos (método `RC` en la matriz) |
| Pruebas automáticas | `node:test` (API), Vitest (frontend), pytest (chatbot) | Confirmar cada control y evitar regresiones: corren en el CI en cada push |
| Escaneo dinámico | OWASP ZAP 2.x (`zap-baseline.py`) | Revisar cabeceras, cookies, CSP y divulgación de información en las respuestas reales |
| Auditoría de dependencias | `npm audit`, `pip-audit` | Vulnerabilidades conocidas en librerías de terceros |
| Pruebas manuales | Navegador, curl, Docker | Flujos completos (login, carrito, chatbot) con la CSP de producción aplicada |

Pruebas de seguridad automatizadas (todas pasan):

| Archivo | Pruebas | Categorías |
|---|---|---|
| `backend/authorization.test.js` | 47 | A01, A07 |
| `backend/security.accessControl.test.js` | 26 | A01 |
| `backend/security.injection.test.js` | 33 | A05 |
| `backend/security.config.test.js` | 11 | A02, A10 |
| `backend/security.alerts.test.js` | 9 | A09 |
| `backend/services/rateLimit.test.js` | 3 | A07 |
| `backend/cartLimits.test.js` | 2 | A06 |
| `src/test/xss.test.tsx` | 3 | A05 |
| `backend/chatbot/tests/test_security.py` | 4 | A05 |

Totales del proyecto al cierre: 265 pruebas de backend, 34 de frontend y 74 del chatbot, todas en verde.

## 4. Resultados por categoría

### A01 — Pérdida de control de acceso
**Qué se probó:** que un cliente no pueda leer ni modificar el perfil, los pedidos, la contraseña, el carrito o el checkout de otro usuario (IDOR); que CLIENTE y VENDEDOR no puedan usar rutas de administrador; tokens ausentes, vencidos, firmados con otra clave, con `alg: none` o con el rol alterado; IDs manipulados en la URL (`/user/07`, `/cart/-7`); y escalamiento de privilegios enviando `role` en el cuerpo.
**Resultado:** todos los controles funcionan. Se encontró y corrigió un caso: un token válido pero sin `id` autorizaba `/user/undefined`, porque `String(undefined) === "undefined"` (SEC-45).
**Pendiente:** verificación manual de las páginas de administración en el navegador con una cuenta de cliente (SEC-05). La protección real está en la API y está verificada.

### A02 — Configuración de seguridad incorrecta
**Qué se probó:** cabeceras HTTP, CORS, `trust proxy`, mensajes de error, endpoints internos expuestos y configuración de Docker.
**Hallazgos corregidos:**
- Faltaban cabeceras de seguridad y se exponía `X-Powered-By`. Se agregó `helmet`, con una CSP estricta para la API (`default-src 'none'`).
- Sin `trust proxy`, en Render todos los clientes compartían la IP del proxy, así que el rate limit bloqueaba a todos a la vez.
- `POST /chatbot/queries` era público y escribía en la base. Ahora exige una clave interna compartida con el chatbot, comparada en tiempo constante.
- El endpoint de prueba `POST /chat/test-log` estaba expuesto. Se eliminó.
- La importación CSV devolvía mensajes internos de la base de datos. Ahora responde con un mensaje genérico.
- El sitio no tenía CSP, `X-Frame-Options` ni HSTS. Se agregaron en `vercel.json` y se verificó que ninguna página rompe.
- El contenedor de la API corría como `root` e instalaba dependencias de desarrollo. Ahora corre como `node` con `npm ci --omit=dev`.
- El CORS del chatbot permitía credenciales y cualquier método o cabecera. Se restringió.

### A03 — Fallas en la cadena de suministro de software
**Qué se probó:** `npm audit` en frontend y backend, y `pip-audit` en el chatbot.
**Resultado:** el frontend tenía 12 vulnerabilidades (8 altas, entre ellas `react-router` y `react-router-dom`, que se ejecutan en el navegador). Se corrigieron con `npm audit fix`, sin cambios de versión mayor, y quedaron en 0; pruebas y build siguen pasando. El backend y el chatbot tienen 0.

### A04 — Fallas criptográficas
**Qué se probó:** almacenamiento de contraseñas, firma de tokens y transporte.
**Resultado:** las contraseñas usan bcrypt con 12 rondas. Los JWT se firman con HS256 y un secreto generado por Render, expiran en 8 horas y los tokens sin firma se rechazan. Todo el tráfico de producción es HTTPS, con HSTS.

### A05 — Inyección
**Qué se probó:** 6 payloads de inyección SQL contra búsqueda, login, búsqueda de usuarios y detalle de producto; XSS almacenado en nombre, descripción y notas de productos y en respuestas del chatbot; validación del campo de imagen; *prompt injection* al chatbot.
**Resultado:** todo el SQL está parametrizado: los payloads viajan siempre como parámetro y la búsqueda de SQL interpolado dio 0 coincidencias. React muestra el HTML como texto y no hay `dangerouslySetInnerHTML`.
**Hallazgos corregidos:**
- El campo `image` aceptaba `javascript:`, `data:` y `http:`. Ahora solo acepta rutas locales o `https://`, en creación, edición e importación CSV.
- `PUT /products/:id` no validaba los datos como `POST`. Ahora usa la misma validación.
- El chatbot no limitaba el largo del mensaje. Ahora acepta hasta 500 caracteres y todos sus prompts incluyen una regla contra la revelación de instrucciones. El historial de conversación rechaza mensajes con rol `system`.

**Pendiente:** prueba manual de *prompt injection* contra el LLM real (SEC-24).

### A06 — Diseño inseguro
**Qué se probó:** manipulación de precios, sobreventa y límites de cantidad.
**Resultado:** el total del checkout se recalcula con el precio de la base de datos y el stock se descuenta en una transacción con `UPDATE … WHERE stock >= cantidad`. Se agregó un tope de 10 unidades por producto en el carrito, aplicado en frontend y backend (SEC-28).
**Pendiente:** controles del checkout de invitado, como rate limit y bloqueo tras pagos rechazados (SEC-29, SFTWRKEY-395).

### A07 — Fallas de autenticación
**Qué se probó:** fuerza bruta, enumeración de usuarios, contraseñas débiles y credenciales por defecto.
**Resultado:** el login responde igual y en un tiempo similar ante un usuario inexistente o una contraseña incorrecta. Con `trust proxy`, el rate limit bloquea solo la IP atacante (SEC-31).
**Abiertos (SFTWRKEY-381):**
- **Crítico:** `seed.js` crea `admin@luxor.com` con una contraseña publicada en el repositorio, y se ejecuta en cada despliegue (SEC-30).
- `/register` no tiene rate limit (SEC-32).
- La contraseña mínima es de 6 caracteres, sin más reglas (SEC-33).

**Aceptados:** ver la sección 7.

### A08 — Fallas de integridad de software y datos
**Resultado:** el CI instala con `npm ci` desde el lockfile y ejecuta los tres conjuntos de pruebas en cada push. Los datos externos (PerfumAPI y CSV) se validan antes de guardarse. Las dependencias del chatbot no tenían versión fija; se fijaron con `==` (SEC-37).

### A09 — Fallas de registro y alertas
**Resultado:** cada login fallido y cada bloqueo del rate limit se registra en `security_events`, y el administrador recibe una alerta cuando una IP supera 10 intentos fallidos en 15 minutos (SFTWRKEY-401). Ningún log imprime el cuerpo de las peticiones, que puede traer contraseñas o datos de tarjeta.

### A10 — Manejo inadecuado de condiciones excepcionales
**Resultado:** un manejador global devuelve errores genéricos en JSON: 400 para JSON malformado, 413 para cuerpos demasiado grandes y 404 para rutas inexistentes, siempre sin stack trace. El checkout, el carrito y la importación usan transacciones con `ROLLBACK`. Las caídas de la pasarela de pago y de PerfumAPI responden 502 controlado.
**Pendiente:** probar la caída del proveedor del LLM (SEC-44).

## 5. Hallazgos y correcciones

| ID | Hallazgo | Severidad | Estado | Ticket |
|---|---|---|---|---|
| SEC-30 | Administrador con contraseña pública creado en producción | Crítica | **Abierto** | SFTWRKEY-381 |
| SEC-07 | Rate limit compartido por todos los usuarios (sin `trust proxy`) | Alta | Corregido y verificado | SFTWRKEY-380 |
| SEC-08 | `POST /chatbot/queries` público que escribe en la base | Alta | Corregido y verificado | SFTWRKEY-380 |
| SEC-31 | Fuerza bruta: límite no efectivo por IP en producción | Alta | Corregido y verificado | SFTWRKEY-380 |
| SEC-15 | 8 vulnerabilidades altas en dependencias del frontend | Media | Corregido y verificado | SFTWRKEY-382 |
| SEC-06 | API sin cabeceras de seguridad | Media | Corregido y verificado | SFTWRKEY-380 |
| SEC-09 | Endpoint de prueba `/chat/test-log` expuesto | Media | Corregido y verificado | SFTWRKEY-380 |
| SEC-10 | Errores de base de datos devueltos al cliente | Media | Corregido y verificado | SFTWRKEY-380 |
| SEC-11 | Sitio sin CSP, `X-Frame-Options` ni HSTS | Media | Corregido (se reverifica después del deploy) | SFTWRKEY-380 |
| SEC-42 | Stack traces en errores no controlados | Media | Corregido y verificado | SFTWRKEY-380 |
| SEC-23 | `PUT /products` sin validación | Media | Corregido y verificado | SFTWRKEY-379 |
| SEC-24 | Chatbot sin límite de mensaje ni defensa ante *prompt injection* | Media | Corregido (falta prueba con el LLM real) | SFTWRKEY-379 |
| SEC-40 | Logins fallidos sin registro ni alerta | Media | Corregido y verificado | SFTWRKEY-401 |
| SEC-32 | `/register` sin rate limit | Media | **Abierto** | SFTWRKEY-381 |
| SEC-33 | Política de contraseñas débil | Media | **Abierto** | SFTWRKEY-381 |
| ZAP | CSP de la API con comodines y sin directivas de respaldo; 404 en HTML | Media | Corregido y verificado | SFTWRKEY-384 |
| SEC-12 | Contenedor como `root` con dependencias de desarrollo | Baja | Corregido y verificado | SFTWRKEY-380 |
| SEC-13 | CORS del chatbot demasiado permisivo | Baja | Corregido y verificado | SFTWRKEY-380 |
| SEC-22 | Campo `image` acepta `javascript:` y `http:` | Baja | Corregido y verificado | SFTWRKEY-379 |
| SEC-28 | Carrito sin tope de cantidad | Baja | Corregido y verificado | SFTWRKEY-391 |
| SEC-37 | Dependencias del chatbot sin versión fija | Baja | Corregido y verificado | SFTWRKEY-382 |
| SEC-45 | Token sin `id` autorizaba `/user/undefined` | Baja | Corregido y verificado | SFTWRKEY-378 |
| ZAP | API sin `Permissions-Policy` | Baja | Corregido y verificado | SFTWRKEY-384 |

## 6. Escaneos OWASP ZAP

| Objetivo | FAIL | Altos | Medios | Bajos | Informativos |
|---|---|---|---|---|---|
| Frontend en producción | 0 | 0 | 4 | 2 | 4 |
| API local, antes de corregir | 0 | 0 | 3 | 2 | 1 |
| API local, después de corregir | 0 | 0 | 0 | 1 | 1 |

Clasificación de los avisos del frontend:

| Aviso | Riesgo | Clasificación | Justificación |
|---|---|---|---|
| CSP: directiva con comodín | Medio | Mitigado y aceptado | `connect-src` se restringió a las URLs exactas de la API y del chatbot. `img-src https:` se mantiene porque las imágenes de productos pueden venir de cualquier proveedor `https` registrado por el administrador; las imágenes no ejecutan código. |
| CSP: `style-src 'unsafe-inline'` | Medio | Aceptado | Lo requieren los estilos que inyecta el botón oficial de Google Sign-In. Los scripts inline siguen bloqueados. |
| Cross-Domain Misconfiguration (`Access-Control-Allow-Origin: *`) | Medio | Falso positivo | Vercel lo aplica a archivos estáticos públicos (JS, CSS, imágenes), que no contienen datos privados ni usan credenciales. |
| Falta Subresource Integrity | Medio | Aceptado | Afecta la hoja de estilos de Google Fonts, que Google genera según el navegador y cambia de contenido, así que no admite un hash fijo. |
| Falta `Cross-Origin-Embedder-Policy` / `Cross-Origin-Opener-Policy` | Bajo | Aceptado | COEP bloquearía las imágenes de otros dominios y COOP rompe la ventana emergente de Google Sign-In. El sitio no usa APIs que las requieran. |
| Comentarios sospechosos, caché, aplicación moderna | Informativo | Falso positivo | Son textos de la interfaz dentro del JavaScript minificado y cabeceras de caché de Vercel. |

En la API se corrigieron todos los avisos medios. Quedan un bajo (COEP, que no aplica a una API JSON) y un informativo (respuestas cacheables del catálogo público).

## 7. Riesgos aceptados y recomendaciones

| Riesgo | Justificación | Recomendación futura |
|---|---|---|
| El registro responde 409 si el correo ya existe (enumeración) | Necesario para la usabilidad del formulario | Mitigarlo con el rate limit de `/register` (SFTWRKEY-381) |
| JWT guardado en `localStorage` | Un XSS podría leerlo. Está mitigado por la CSP y por el escape de React (sin XSS encontrados) | Migrar a cookie `httpOnly` + `SameSite` |
| Rate limit en memoria | Válido con una sola instancia de la API, como ahora | Usar Redis si se escala a varias instancias |

**Antes de entregar:** cerrar SFTWRKEY-381 (SEC-30, SEC-32 y SEC-33) y cambiar en producción la contraseña de la cuenta de administrador de demostración.

**Verificaciones pendientes:** SEC-05 (páginas de administración con una cuenta de cliente), SEC-24 y SEC-44 (chatbot con el LLM real), SEC-29 (checkout de invitado, SFTWRKEY-395) y SEC-36 (login con Google, SFTWRKEY-398).

## 8. Anexos

| Anexo | Archivo |
|---|---|
| A. Matriz de riesgos OWASP (45 riesgos) | `docs/security/MATRIZ_OWASP.md` |
| B. ZAP — frontend en producción | `docs/security/anexos/zap-frontend-produccion.html` |
| C. ZAP — API antes y después | `docs/security/anexos/zap-api-local-antes.html`, `zap-api-local-despues.html` |
| D. `npm audit` — frontend antes y después | `docs/security/anexos/npm-audit-frontend-antes.txt`, `npm-audit-frontend-despues.txt` |
| E. `npm audit` — backend | `docs/security/anexos/npm-audit-backend.txt` |
| F. `pip-audit` — chatbot | `docs/security/anexos/pip-audit-chatbot.txt` |
| G. Pruebas automáticas | Archivos de la sección 3; se ejecutan en el CI (`.github/workflows/tests.yml`) |
