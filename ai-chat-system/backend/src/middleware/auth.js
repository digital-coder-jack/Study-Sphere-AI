import 'dotenv/config';

// Simple bearer-token gate. Clients send: Authorization: Bearer <GATEWAY_API_KEY>
export function auth(req, res, next) {
  const expected = process.env.GATEWAY_API_KEY;
  if (!expected) return next(); // no key configured -> open (dev only)

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token !== expected) {
    return res.status(401).json({ error: { message: 'Invalid API key', type: 'auth_error' } });
  }
  next();
}
