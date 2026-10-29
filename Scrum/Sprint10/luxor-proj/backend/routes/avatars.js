import express, { Router } from 'express';
import sharp from 'sharp';
import pool from '../db.js';
import { authenticate, authorizeSelfOrRoles } from '../services/auth.js';
import { rateLimit } from '../services/rateLimit.js';

// Feedback del cliente: foto de perfil. Igual que las fotos de productos (SFTWRKEY-457): sharp
// revisa que el archivo sea de verdad una imagen y la guarda como WebP cuadrado de 256 px en la base
// (el disco de Render se borra en cada deploy). A diferencia de esas, esta es privada: solo la ven
// su dueño y los admin, con la cookie de sesión.
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const FORMATOS = ['png', 'jpeg', 'webp'];
const SIZE = 256;

const router = Router();
const soloDueno = [authenticate, authorizeSelfOrRoles('userId', 'ADMIN')];

router.post(
  '/user/:userId/avatar',
  ...soloDueno,
  rateLimit({ windowMs: 60_000, max: 10 }),
  express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: MAX_AVATAR_BYTES }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ success: false, message: 'Sube una foto PNG, JPG o WebP.' });
    }

    let webp;
    try {
      const { format } = await sharp(req.body).metadata();
      if (!FORMATOS.includes(format)) {
        return res.status(400).json({ success: false, message: 'Sube una foto PNG, JPG o WebP.' });
      }
      webp = await sharp(req.body).rotate().resize(SIZE, SIZE, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
    } catch {
      return res.status(400).json({ success: false, message: 'No se pudo leer la foto. Prueba con otra.' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO user_avatars (user_id, data, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
         RETURNING EXTRACT(EPOCH FROM updated_at)::bigint AS version`,
        [req.params.userId, webp]
      );
      res.status(201).json({ success: true, avatarVersion: Number(result.rows[0].version) });
    } catch (err) {
      console.error('Error guardando la foto de perfil:', err.message);
      res.status(500).json({ success: false, message: 'No se pudo guardar la foto.' });
    }
  }
);

router.get('/user/:userId/avatar', ...soloDueno, async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM user_avatars WHERE user_id = $1', [req.params.userId]);
    if (result.rows.length === 0) {
      return res.set('Cache-Control', 'no-store').status(404).json({ success: false, message: 'Sin foto de perfil.' });
    }
    // private: ningún caché compartido (CDN) la guarda; la URL lleva ?v= y cambia con cada foto nueva
    res.set('Cache-Control', 'private, max-age=86400').type('image/webp').send(result.rows[0].data);
  } catch (err) {
    console.error('Error leyendo la foto de perfil:', err.message);
    res.status(500).json({ success: false, message: 'No se pudo cargar la foto.' });
  }
});

router.delete('/user/:userId/avatar', ...soloDueno, async (req, res) => {
  try {
    await pool.query('DELETE FROM user_avatars WHERE user_id = $1', [req.params.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error quitando la foto de perfil:', err.message);
    res.status(500).json({ success: false, message: 'No se pudo quitar la foto.' });
  }
});

// si el archivo pasa de 5 MB, express.raw lanza un error 413: se responde con un mensaje claro
router.use('/user/:userId/avatar', (err, _req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'La foto pesa más de 5 MB.' });
  }
  next(err);
});

export default router;
