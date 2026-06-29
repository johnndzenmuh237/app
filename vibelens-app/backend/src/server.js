require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const userRoutes = require('./routes/user');
const aiRoutes = require('./routes/ai');
const paymentRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 8080;

// ----------------------------------------------------------------
// Security & logging middleware
// ----------------------------------------------------------------
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (native apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS: ' + origin));
  }
}));

// Stripe webhook needs the RAW body to verify signatures — mount it BEFORE express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// General rate limiting — protects the OpenAI-calling routes from abuse/cost overrun.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,                  // 60 AI calls per IP per 15 min — tune to your budget
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait a few minutes and try again.' }
});
app.use('/api/ai', aiLimiter);

// ----------------------------------------------------------------
// Routes
// ----------------------------------------------------------------
app.get('/health', (req, res) => res.json({ ok: true, service: 'vibelens-backend', time: new Date().toISOString() }));

app.use('/api/user', userRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/payments', paymentRoutes);

// 404 fallback
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// Central error handler (catches anything that slipped past route-level try/catch)
app.use((err, req, res, next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`VibeLens backend listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
