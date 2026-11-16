import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import campaignRoutes from './routes/campaigns.js';
import donationRoutes from './routes/donations.js';
import payuRoutes, { payuDonationRoutes } from './routes/payu.js';
import deliveryRoutes from './routes/deliveries.js';
import adminRoutes from './routes/admin.js';
import { pool } from './db/pool.js';
import { notFound, errorHandler } from './middleware/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(__dirname, '../public');
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.tailwindcss.com', 'https://unpkg.com', 'https://cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://unpkg.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ["'self'"],
      formAction: ["'self'", 'https://sandbox.checkout.payulatam.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));

const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  if (!origin || !process.env.APP_BASE_URL) return next();
  try {
    if (new URL(origin).origin !== new URL(process.env.APP_BASE_URL).origin) {
      return res.status(403).json({ error: 'Origen de solicitud no permitido.' });
    }
  } catch {
    return res.status(403).json({ error: 'Origen de solicitud inválido.' });
  }
  return next();
});

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', service: 'CeroHambre API' });
  } catch (error) { next(error); }
});
app.use('/api/auth', authRoutes);
app.use('/api/campanas', campaignRoutes);
app.use('/api/donaciones', payuDonationRoutes);
app.use('/api/donaciones', donationRoutes);
app.use('/api/pagos/payu', payuRoutes);
app.use('/api', deliveryRoutes);
app.use('/api/admin', adminRoutes);
app.use(express.static(publicDirectory, { extensions: ['html'] }));
app.use(notFound);
app.use(errorHandler);

export default app;
