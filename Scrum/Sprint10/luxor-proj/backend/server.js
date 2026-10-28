import express from "express";
import { pathToFileURL } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";

// Routers extraídos hacia otros archivos
import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import externalPerfumesRouter from './routes/externalPerfumes.js';
import importsRouter from './routes/imports.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import cartRouter from './routes/cart.js';
import reportsRouter from './routes/reports.js';
import securityRouter from './routes/security.js';
import checkoutRouter from './routes/checkout.js';
import chatbotRouter from './routes/chatbot.js';

import ordersRouter from './routes/orders.js';
import passwordResetRouter from './routes/passwordReset.js';
import wishlistRouter from './routes/wishlist.js';
import relatedRouter from './routes/related.js';
import productImagesRouter from './routes/productImages.js';
import orderLookupRouter from './routes/orderLookup.js';
import commerceRouter from './commerce.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// SFTWRKEY-380: Render pone un proxy delante; sin esto req.ip es la IP del proxy
// y el rate limit bloquea a todos los usuarios a la vez.
app.set("trust proxy", 1);
// Cabeceras de seguridad (HSTS, nosniff, frameguard, etc.) y sin X-Powered-By.
// SFTWRKEY-384: la API solo devuelve JSON, así que su CSP no permite cargar nada
// (hallazgos de ZAP "CSP: Wildcard Directive" y "Failure to Define Directive").
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use((_req, res, next) => {
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: "2mb" }));

// SFTWRKEY-425: rutas separadas por funcionalidad.
app.use(productsRouter);
app.use(categoriesRouter);
app.use(externalPerfumesRouter);
app.use(importsRouter);
app.use(authRouter);
app.use(usersRouter);
app.use(cartRouter);
app.use(reportsRouter);
app.use(securityRouter);
app.use(checkoutRouter);
app.use(chatbotRouter);

app.get("/", (req, res) => res.send("Backend Luxor funcionando"));

// SFTWRKEY-417: rutas de pedidos del admin
app.use(ordersRouter);

// SFTWRKEY-428: recuperar contraseña (antes del router de commerce, que prepara tablas en cada petición)
app.use(passwordResetRouter);

// SFTWRKEY-429: lista de deseos
app.use(wishlistRouter);

// SFTWRKEY-430: productos relacionados
app.use(relatedRouter);

// SFTWRKEY-457: fotos de productos subidas desde el panel
app.use(productImagesRouter);

// SFTWRKEY-458: el chatbot consulta el estado de un pedido (número + correo)
app.use(orderLookupRouter);

// Checkout de invitado, login con Google y alertas del admin. Va al final porque su
// middleware prepara las tablas en cada petición que entra al router: así solo lo
// alcanzan las rutas que no atendió ninguna de las anteriores.
app.use(commerceRouter);

// SFTWRKEY-384: 404 en JSON (el 404 por defecto de Express es HTML y trae su propia CSP).
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Recurso no encontrado." });
});

// SFTWRKEY-380: manejador global de errores. Nunca devuelve mensajes internos ni el
// stack trace (sin él, Express los muestra cuando NODE_ENV no es "production").
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "El cuerpo de la solicitud no es un JSON válido." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "La solicitud es demasiado grande." });
  }
  console.error(err);
  res.status(500).json({ success: false, message: "Error interno del servidor." });
});

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
}

export default app;