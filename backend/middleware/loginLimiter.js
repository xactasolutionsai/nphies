import rateLimit from 'express-rate-limit';

export function createLoginLimiter(options = {}) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'Too many failed login attempts. Try again later.' },
    ...options
  });
}
