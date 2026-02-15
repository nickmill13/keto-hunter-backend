const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { createClerkClient } = require('@clerk/backend');
const path = require('path');
const dotenvResult = require('dotenv').config({ path: path.resolve(__dirname, '.env') });
if (dotenvResult.error) {
  console.log('[WARN] .env not loaded:', dotenvResult.error.message);
} else {
  console.log('[OK] .env loaded from:', path.resolve(__dirname, '.env'));
}

// Load data files
const chainMenuData = require('./chain-menus.json');
console.log('[OK] Chain menu data loaded:', Object.keys(chainMenuData).join(', '));

const localMenuDataFile = require('./local-menus.json');
const localMenuVerified = Object.fromEntries(
  Object.entries(localMenuDataFile).filter(([key]) => !key.startsWith('_'))
);
console.log(`[OK] Local menu data loaded: ${Object.keys(localMenuVerified).length} restaurants`);

// Load lib modules
const scoring = require('./lib/scoring');
const reviewAnalysis = require('./lib/review-analysis');

// Initialize scoring with chain menu data
scoring.init(chainMenuData);

console.log('=== STARTUP DIAGNOSTICS ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
console.log('GOOGLE_PLACES_API_KEY exists:', !!process.env.GOOGLE_PLACES_API_KEY);
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('CLERK_SECRET_KEY exists:', !!process.env.CLERK_SECRET_KEY);

// Initialize Clerk client
let clerkClient = null;
if (process.env.CLERK_SECRET_KEY) {
  clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  console.log('[OK] Clerk client initialized');
} else {
  console.log('[WARN] Clerk secret key not found - auth verification disabled');
}

// Initialize OpenAI client
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('[OK] OpenAI client initialized');
} else {
  console.log('[WARN] OpenAI API key not found - AI suggestions will be disabled');
}

// Try to load database with error handling
let db = {};
try {
  console.log('Attempting to load database module...');
  db = require('./database');
  console.log('[OK] Database module loaded successfully');
} catch (error) {
  console.error('[ERROR] FAILED TO LOAD DATABASE MODULE:');
  console.error('Error message:', error.message);
  console.error('Error stack:', error.stack);
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Middleware to verify Clerk token and extract user ID
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!clerkClient) {
    return res.status(500).json({ error: 'Auth service not configured' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { sub: userId } = await clerkClient.verifyToken(token);
    req.userId = userId;
    next();
  } catch (error) {
    console.error('[ERROR] Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'Keto Hunter API is running!',
    database: db.saveReview ? 'connected' : 'NOT CONNECTED - check logs',
    clerk: !!clerkClient ? 'configured' : 'NOT CONFIGURED',
    timestamp: new Date().toISOString()
  });
});

// Mount route modules
const deps = { db, requireAuth, scoring, reviewAnalysis, openai, chainMenuData, localMenuVerified };

app.use(require('./routes/search')({ scoring }));
app.use(require('./routes/reviews')({ db, requireAuth }));
app.use(require('./routes/signals')({ db, requireAuth, scoring, reviewAnalysis, chainMenuData }));
app.use(require('./routes/menu')({ scoring, openai, chainMenuData, localMenuVerified, reviewAnalysis }));

// Initialize database on startup
if (db.initDatabase) {
  db.initDatabase()
    .then(() => console.log('[OK] Database tables initialized'))
    .catch(err => console.error('[ERROR] Database initialization error:', err));
} else {
  console.error('[ERROR] Cannot initialize database - initDatabase function not available');
}

app.listen(PORT, () => {
  console.log(`Keto Hunter API running on port ${PORT}`);
  console.log(`Database status: ${db.saveReview ? '[OK] Connected' : '[ERROR] Not Connected'}`);
  console.log(`Clerk status: ${clerkClient ? '[OK] Configured' : '[ERROR] Not Configured'}`);
});
