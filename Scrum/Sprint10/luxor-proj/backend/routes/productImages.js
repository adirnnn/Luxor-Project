import express, { Router } from 'express';
import sharp from 'sharp';
import pool from '../db.js';
import { authenticate, requireRoles } from '../services/auth.js';

const router = Router();

// SFTWRKEY-457: fotos que el admin sube desde el panel. Se pasan a WebP de 800 px y se guardan
// en la base (el disco de Render se borra en cada deploy). El frontend las pide en
// /product-images/<id>.webp y Vercel las reenvía aquí, así la ruta queda local.
export const MAX_FOTO_BYTES = 5 * 1024 * 1024;
const FORMATOS = ['png', 'jpeg', 'webp'];

router.post(
  '/admin/product-images',
  authenticate,
  requireRoles('ADMIN'),
  express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: MAX_FOTO_BYTES }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ message: 'Sube una foto PNG, JPG o WebP.' });
    }

    let webp;
    try {
      // no se confía en el Content-Type: sharp revisa que el archivo de verdad sea una imagen
      const { format } = await sharp(req.body).metadata();
      if (!FORMATOS.includes(format)) {
        return res.status(400).json({ message: 'Sube una foto PNG, JPG o WebP.' });
      }
      webp = await sharp(req.body)
        .rotate()
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      return res.status(400).json({ message: 'No se pudo leer la foto. Prueba con otra.' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO product_images (data) VALUES ($1) RETURNING id`,
        [webp]
      );
      res.status(201).json({ image: `/product-images/${result.rows[0].id}.webp`, size: webp.length });
    } catch (err) {
      console.error('Error guardando la foto del producto:', err.message);
      res.status(500).json({ message: 'No se pudo guardar la foto.' });
    }
  }
);

// Vercel guarda en su CDN lo que esta ruta responde con caché. Un error nunca se guarda: si se guardara
// un 404, la foto con ese id se vería rota aunque el admin la subiera después.
const sinFoto = (res, status, message) => res.set('Cache-Control', 'no-store').status(status).json({ message });

// .webp para la tienda y .jpg para compartir el enlace (WhatsApp y Facebook no siempre muestran WebP)
const verFoto = (formato) => async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return sinFoto(res, 404, 'Foto no encontrada.');
  }

  try {
    const result = await pool.query(`SELECT data FROM product_images WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return sinFoto(res, 404, 'Foto no encontrada.');
    }
    const data = formato === 'jpg'
      ? await sharp(result.rows[0].data).flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
      : result.rows[0].data;
    // una foto nunca cambia (si el admin sube otra, tiene otro id), así que se guarda en caché un año
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.type(formato === 'jpg' ? 'image/jpeg' : 'image/webp').send(data);
  } catch (err) {
    console.error('Error leyendo la foto del producto:', err.message);
    sinFoto(res, 500, 'No se pudo cargar la foto.');
  }
};

router.get('/product-images/:id.webp', verFoto('webp'));
router.get('/product-images/:id.jpg', verFoto('jpg'));

// si el archivo pasa de 5 MB, express.raw lanza un error 413: se responde con un mensaje claro
router.use('/admin/product-images', (err, _req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'La foto pesa más de 5 MB.' });
  }
  next(err);
});

export default router;
