# Retrospectiva del Sprint 10 y del proyecto

**Proyecto:** Perfumería Victoria · **Sprint:** 10 (17 al 23 de octubre de 2026, con cierre extendido hasta noviembre) · **Ticket:** SFTWRKEY-463

**Equipo:** Adrián López, Javier Chávez, Diego Sandoval, Dally Ramírez y Denis Rodríguez. El registro de tiempo de cada integrante está en [LOGT_Sprint10_Equipo.docx](LOGT_Sprint10_Equipo.docx).

> Borrador armado con lo que quedó registrado en el repositorio, el CI y producción. Se completa y se ajusta en la reunión de retrospectiva del equipo.

## 1. Lo que se entregó en el Sprint 10

| Área | Resultado |
|---|---|
| Pagos | Recurrente con página de pago alojada (la tarjeta nunca pasa por el servidor), confirmación por webhook firmado y sin cobros duplicados |
| Ciclo de compra | Correos de confirmación y de cambio de estado, envío y forma de entrega guardados en el pedido, página de confirmación y comprobante en PDF |
| Tienda | Reseñas de compradores, cupones de descuento, rol Mayorista con un porcentaje que define el administrador, consulta del pedido en el chatbot |
| Seguridad | Sesión en cookie httpOnly, matriz OWASP con 69 riesgos y ninguno abierto, auditorías de dependencias en 0 |
| Calidad | Pruebas de extremo a extremo con Playwright en el CI, imágenes optimizadas, `server.js` dividido en routers |
| Feedback del cliente | Las 13 observaciones de la revisión se atendieron: aviso de sesión vencida, portada con los más vendidos, colores por estado, vistas móviles, mapas de Waze y horarios de los locales, foto de perfil y rol Mayorista |

## 2. Lo que funcionó

- **Las pruebas automáticas como red de seguridad.** Más de 800 pruebas (unitarias, integración y regresión con PostgreSQL real, frontend, chatbot y navegador real) corren en cada push. Varias veces detectaron un cambio que rompía algo antes de que llegara al cliente.
- **La matriz OWASP como lista de trabajo.** Cada tarea que tocaba pagos, sesión o datos personales agregó su fila con su prueba, así la seguridad avanzó junto con las funciones y no al final.
- **Elegir un proveedor de pagos con página alojada.** Con Recurrente el número de tarjeta nunca toca nuestro servidor, lo que eliminó de raíz el riesgo más grave de una tienda en línea.
- **Tareas con criterios de aceptación concretos.** El backlog detallado (qué hacer, dónde y cómo se comprueba) permitió repartir el trabajo sin depender de explicaciones en persona.
- **Escuchar al cliente en la revisión.** Las 13 observaciones se resolvieron en pocos días porque eran puntuales y se discutieron con ejemplos.

## 3. Lo que no funcionó

- **La base de datos gratuita venció con el sitio en producción.** El backlog lo advertía desde el día 1 (vencía el 6 de noviembre), pero nadie tenía la tarea asignada. El sitio estuvo caído dos días y hubo que recrear la base desde cero, perdiendo los datos de prueba acumulados.
- **Trabajo duplicado.** El comprobante en PDF (SFTWRKEY-433) se hizo dos veces en paralelo con enfoques distintos porque no quedó claro quién lo estaba trabajando.
- **Cambios que esperaron demasiado sin subirse.** Hubo trabajo terminado que quedó días en una sola computadora; al subirlo chocaba con lo que otros ya habían subido.
- **Un cambio rompió las pruebas de extremo a extremo y siguió igual en `main`.** El CI lo marcó en rojo, pero nadie lo revisó hasta el siguiente push.
- **La documentación de cierre quedó para el final.** El informe final, el documento técnico y la presentación se empezaron después de terminar el código, con el tiempo más apretado.
- **El sprint de 7 días no alcanzó.** 25 tareas y 53 puntos en una semana era más de lo que el equipo podía cerrar con calidad; el cierre se extendió.

## 4. Lo que haríamos distinto

| Problema | Qué haríamos |
|---|---|
| Riesgos de infraestructura sin dueño (base que vence, backend que se duerme, dominio) | Convertir cada riesgo del anexo del backlog en una tarea con responsable y fecha, igual que las de código |
| Trabajo duplicado | Mover la tarea a "En progreso" en el tablero antes de empezar y avisar en el chat del equipo |
| Cambios guardados localmente por días | Subir al menos una vez al día, aunque la tarea no esté terminada, en una rama propia |
| CI en rojo sin atender | Quien sube el cambio que rompe el CI lo arregla ese mismo día, antes de seguir con otra tarea |
| Documentos al final | Escribir el documento técnico y los manuales durante el sprint, un poco con cada tarea |
| Sprint final muy cargado | Planear el último sprint con menos puntos y dejar un día completo solo para cierre y ensayo |

## 5. Retrospectiva del proyecto completo (Sprints 1 a 10)

**Lo que más aprendimos**

- Una tienda en línea es mucho más que el catálogo: pagos, correos, envíos, seguridad, respaldos y el trabajo del administrador pesan tanto como lo que ve el comprador.
- Las pruebas automáticas valen más cuanto antes se escriben; en los últimos sprints permitieron cambiar mucho sin miedo.
- La seguridad se hace mejor con una lista viva (la matriz) que con una revisión única al final.
- Los servicios gratuitos (Render, Vercel) son ideales para aprender, pero tienen límites (bases que vencen, servidores que se duermen) que hay que planear desde el principio si el producto se va a entregar.

**Si empezáramos de nuevo**

- Definiríamos desde el Sprint 1 dónde va a vivir la plataforma en producción y cuánto cuesta mantenerla, y lo hablaríamos con el cliente.
- Configuraríamos el CI con pruebas desde el primer sprint, no a mitad del proyecto.
- Mantendríamos una sola rama principal y ramas cortas por tarea, para no tener una rama `staging` que se aleje de `main`.

## 6. Acuerdos para la entrega

- [ ] Revisar este borrador en equipo y agregar la opinión de cada integrante.
- [ ] Decidir con el cliente dónde va a vivir la base de datos después de la entrega (la actual vence el 8 de diciembre de 2026).
- [ ] Cerrar las tareas pendientes del backlog antes de la presentación.
