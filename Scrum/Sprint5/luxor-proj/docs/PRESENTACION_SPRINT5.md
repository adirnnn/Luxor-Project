# Presentacion Sprint 5 — Habibi Parfums

Guion de 32 diapositivas. Agrega una captura real en cada marcador **[CAPTURA]**. La evidencia se revisó contra Sprint4/Sprint5 y commits desde `b6e830c` (17 de julio de 2026).

## 1. Portada

**Sprint 5 — Habibi Parfums**  
*Inteligencia, compra y administracion de inventario*  
Demo del incremento · 17–28 de julio de 2026.  
**[CAPTURA: Home Sprint5]**

## 2. Problema

- Sprint4 tenia catalogo, carrito y administracion basica.
- Faltaba orientar la eleccion de fragancias, cerrar compras y cargar inventario a escala.
- El objetivo fue mejorar conversion y operacion sin perder consistencia de datos.

## 3. Solucion

- Chatbot conversacional para dudas de fragancias.
- Checkout con formulario, validacion, orden y errores claros.
- Categorias e importacion CSV auditable para administrar inventario.

**[VISUAL: React/Vite → Express + FastAPI chatbot → PostgreSQL]**

## 4. Sprint4 vs Sprint5

| Area | Sprint4 | Sprint5 |
| --- | --- | --- |
| Compra | Carrito | Checkout, confirmacion y control de stock |
| Inventario | ABM individual | Categorias e importacion CSV |
| Asistencia | Sin guia conversacional | UI y API de chatbot |
| Datos | Productos planos | `products.category_id → categories.id` |

## 5. Stack

- React, TypeScript, Vite, Tailwind CSS y Framer Motion.
- Node.js, Express y PostgreSQL.
- FastAPI, Pydantic y proveedor LLM desacoplado.
- Docker Compose para frontend, backend y base de datos.

# Epica 1 — Chatbot inteligente

## 6. Crear interfaz del chatbot

- Boton flotante y panel de conversacion disponibles en la aplicacion.
- Interfaz consistente con Habibi y estados de apertura/cierre.
- **[CAPTURA: burbujas WhatsApp, Instagram y chatbot]**

## 7. Flujo basico de conversacion

- Mensaje del usuario, historial de sesion y estado `Pensando...`.
- El usuario puede enviar preguntas consecutivas sin salir de la pagina.
- **[CAPTURA: pregunta y respuesta]**

## 8. Conexion chatbot-backend

- `chatbotService` comunica React con una API FastAPI.
- CORS local y router separado del proveedor LLM.
- Evidencia: `3bdbd46`, `4f80688`, `dedfadc`.

## 9. Respuestas dinamicas

- La API delega el mensaje a `LLMProvider` y devuelve la respuesta al hilo.
- La abstraccion permite cambiar de proveedor sin reescribir la UI.
- **[CAPTURA: dos respuestas distintas]**

## 10. Errores de comunicacion

- Cuando el servicio no responde, el hilo muestra un mensaje entendible.
- La interfaz se recupera y permite reintentar.
- **[CAPTURA: error simulado]**

> No marcar como completadas consultas del catalogo desde el chatbot ni prueba E2E: no hay evidencia de esas entregas en el repositorio.

# Epica 2 — Sistema de pagos

## 11. Disenar pagina de pagos

- Ruta protegida, diseno responsive y acceso desde el carrito.
- **[CAPTURA: Pago Seguro]**

## 12. Mostrar resumen de compra

- Articulos, imagenes, cantidades, subtotal, envio y total.
- **[CAPTURA: resumen lateral]**

## 13. Implementar formulario de pago

- Campos de tarjeta y estado de procesamiento para evitar reenvios.
- **[CAPTURA: formulario lleno]**

## 14. Validar datos ingresados

- Validaciones de formato y requeridos; prevencion de pago sin stock.
- **[CAPTURA: errores de formulario]**

## 15. Procesar solicitud de pago

- `checkoutService` ejecuta `POST /checkout/:userId`.
- El backend registra ordenes y usa el carrito del usuario.
- **[CAPTURA: orden creada]**

## 16. Confirmacion de compra

- Pantalla de exito con pedido, total y accesos para continuar.
- El carrito se limpia al completar la compra.
- **[CAPTURA: Pago Exitoso]**

## 17. Errores de pago

- Errores de stock, pago y red con detalle de articulos afectados.
- **[CAPTURA: alerta de stock]**

> El flujo registra una orden interna. No presentar integracion con Stripe, PayPal u otra pasarela sin evidencia adicional.

# Epica 3 — Mejoras de frontend

## 18. Mejorar Home

- Hero cinematografico, catalogo destacado, marca, CTA y footer de contacto.
- **[CAPTURA: Home completa]**

## 19. Product Page y componentes reutilizables

- Ficha de perfume, carrito y UI reutilizan layout, tipografia y botones.
- Estados de carga y error para consumo de productos.
- **[CAPTURA: detalle de perfume]**

## 20. Responsive y bugs visuales

- Navbar responsive; anclas de Nosotros/Contacto desde cualquier ruta.
- Accesos flotantes consistentes para WhatsApp, Instagram y chatbot.
- **[CAPTURA: movil / navbar]**

> No afirmar metricas de performance o auditoria de accesibilidad: no se encontraron reportes Lighthouse o pruebas dedicadas.

# Epica 4 — Base de datos

## 21. Relacionar perfumes con categorias

- Tabla `categories`, categorias iniciales y `category_id` por perfume.
- Evidencia: `cdd7245` (SFTWRKEY-273, 274, 275).
- **[CAPTURA: categoria de perfume]**

## 22. Modelo relacional e integridad

- `products.category_id` referencia `categories(id)`.
- `ON DELETE SET NULL` evita referencias rotas.
- Seed compatible con bases existentes mediante `ADD COLUMN IF NOT EXISTS`.

> Proveedores, indices y optimizacion SQL quedan fuera del alcance demostrado.

# Epica 5 — Importacion masiva

## 23. Disenar formato CSV

- Plantilla y especificacion: `id,name,price,image,description,stock,salida,corazon,fondo`.
- **[CAPTURA: plantilla CSV]**

## 24. Lectura de archivos

- Selector `.csv`, `File.text()` y parser que acepta comillas/saltos de linea.
- **[CAPTURA: archivo seleccionado]**

## 25. Validar estructura

- Encabezados y columnas exactas; IDs, precio, stock y limites de campos.
- Errores con fila, campo y causa.
- **[CAPTURA: validaciones]**

## 26. Importar perfumes

- Insercion transaccional; IDs existentes rechazados.
- `npm test`: 2/2 pruebas del parser y validador exitosas.
- **[CAPTURA: importacion exitosa]**

## 27. Manejar errores de importacion

- Extension, CSV vacio, comillas, encabezados y filas invalidas son controlados.
- **[CAPTURA: filas rechazadas]**

## 28. Resumen e historial

- Filas leidas, importadas y rechazadas.
- `product_imports` conserva archivo, conteos, errores y fecha.
- Historial visible en `/admin/importar`.
- **[CAPTURA: historial]**

> Importacion de categorias no esta demostrada; el alcance entregado cubre perfumes.

# Epica 6 — Scrum y documentacion

## 29. Documentacion tecnica y demo

- README de Habibi, guia CSV y ejecucion con Docker Compose.
- Evidencia: `d3f7904`, `ac96f67`, `31cbda1`.
- **[CAPTURA: README o Docker]**

## 30. Evidencia Scrum por agregar

- Adjuntar Product Backlog, Sprint Backlog, Jira, Burndown, velocidad, retrospectiva y feedback.
- **[CAPTURA: Jira y Burndown]**

## 31. Linea de tiempo

| Fecha | Hito |
| --- | --- |
| 17 jul | `b6e830c`: inicio de carpeta Sprint5 |
| 24–26 jul | Base chatbot, CSV y README |
| 27 jul | Categorias y pagos |
| 28 jul | Integracion de chatbot y staging |

## 32. Cierre

**Sprint5 mejora conversion y operacion:** asistente conversacional, checkout, categorias e importacion CSV con trazabilidad.

Siguiente recomendacion: conectar chatbot al catalogo real, pasarela de pago, proveedores/indices y metricas Scrum.

**Gracias.**
