const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// ── Validate required environment variables at startup ─────
const REQUIRED_ENV = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
  console.error('Check your .env file against .env.example and restart.');
  process.exit(1);
}

// Warn (not fatal) about optional but important keys
const WARN_ENV = ['CLIENT_URL', 'CLOUDINARY_CLOUD_NAME', 'RAZORPAY_KEY_ID', 'OPENAI_API_KEY'];
WARN_ENV.forEach(k => {
  if (!process.env[k]) console.warn(`[WARN] ${k} is not set — related features will use fallbacks or be disabled.`);
});

const { connectDB } = require('./src/config/db');

const authRoutes       = require('./src/routes/auth.routes');
const workspaceRoutes  = require('./src/routes/workspace.routes');
const projectRoutes    = require('./src/routes/project.routes');
const onboardingRoutes = require('./src/routes/onboarding.routes');
const creditsRoutes    = require('./src/routes/credits.routes');
const profileRoutes    = require('./src/routes/profile.routes');
const questionsRoutes  = require('./src/routes/questions.routes');
const wishlistRoutes   = require('./src/routes/wishlist.routes');

const app = express();

// ── Security headers (Helmet) ──────────────────────────────
app.use(helmet({
  // Allow Razorpay checkout iframe to load
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ───────────────────────────────────────────────────
// Fail loudly in production if CLIENT_URL is not set
const allowedOrigin = process.env.CLIENT_URL;
if (!allowedOrigin && process.env.NODE_ENV === 'production') {
  console.error('[FATAL] CLIENT_URL must be set in production to configure CORS.');
  process.exit(1);
}
app.use(cors({
  origin: allowedOrigin || 'http://localhost:5173',
  credentials: true,
}));

// ── Raw body capture for Razorpay webhook ─────────────────
// Must be before express.json() so the webhook handler can
// verify the x-razorpay-signature against the original bytes.
app.use((req, res, next) => {
  if (req.path === '/api/credits/webhook') {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      req.rawBody = data;
      try { req.body = JSON.parse(data || '{}'); } catch { req.body = {}; }
      next();
    });
  } else {
    next();
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rate limiters ──────────────────────────────────────────
// Strict: login & register — 10 attempts per 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again after 15 minutes.' },
});

// Looser: OTP resend & forgot-password — 5 per 10 min per IP
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests. Please wait 10 minutes before trying again.' },
});

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth/login',           authLimiter);
app.use('/api/auth/register',        authLimiter);
app.use('/api/auth/resend-otp',      otpLimiter);
app.use('/api/auth/forgot-password', otpLimiter);

app.use('/api/auth',       authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/projects',   projectRoutes);
app.use('/api/projects/:projectId/questions', questionsRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/credits',    creditsRoutes);
app.use('/api/profile',    profileRoutes);
app.use('/api/wishlist',   wishlistRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Docket Factory API running' }));

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
});
