export const createDeclineGuard = ({ max = 3, windowMs = 15 * 60_000, onBlock } = {}) => {
    const declines = new Map();

    // devuelve la entrada vigente de la IP o undefined si ya venció
    const current = (key, now) => {
        const entry = declines.get(key);
        if (!entry) return undefined;
        const expired = entry.blockedUntil ? now >= entry.blockedUntil : now - entry.start > windowMs;
        if (expired) {
        declines.delete(key);
        return undefined;
        }
        return entry;
    };

    // middleware: si la IP está bloqueada responde 429 sin llegar a la pasarela
    const check = (req, res, next) => {
        if (current(req.ip, Date.now())?.blockedUntil) {
        return res.status(429).json({
            success: false,
            message: 'Demasiados pagos rechazados. Intenta de nuevo más tarde.',
        });
        }
        next();
    };

    // se llama cada vez que la pasarela rechaza un pago
    const recordDecline = (req) => {
        const now = Date.now();
        const entry = current(req.ip, now) ?? { start: now, count: 0 };
        entry.count += 1;
        if (entry.count >= max && !entry.blockedUntil) {
        entry.blockedUntil = now + windowMs;
        onBlock?.(req);
        }
        declines.set(req.ip, entry);
    };

    return { check, recordDecline };
};
