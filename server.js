require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/database');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');

// Import routes
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/company');
const movieRoutes = require('./routes/movies');
const newsRoutes = require('./routes/news');
const teamRoutes = require('./routes/team');
const licensingRoutes = require('./routes/licensing');
const marketingRoutes = require('./routes/marketing');
const navigationRoutes = require('./routes/navigation');
const uploadRoutes = require('./routes/upload');
const settingsRoutes = require('./routes/settings');
const messagesRoutes = require('./routes/messages');
const seoRoutes = require('./routes/seo');
const careersRoutes = require('./routes/careers');
const jobApplicationsRoutes = require('./routes/job-applications');
const analyticsRoutes = require('./routes/analytics');
const feedRoutes = require('./routes/feed');

const app = express();

// Connect to Database
connectDB();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Disable for development, configure for production
}));

// Compression middleware for better performance
app.use(compression());

// Rate limiting to prevent abuse
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 login attempts per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes.'
  }
});

// Apply rate limiting
app.use(generalLimiter);

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3007',
      'http://localhost:3008',
      'https://wpcadmin.govindvyas.com',
      'https://wpcdemo.govindvyas.com',
      'http://wpcadmin.govindvyas.com',
      'http://wpcdemo.govindvyas.com'
    ];
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Apply stricter rate limiting to auth routes
app.use(`${API_PREFIX}/auth`, authLimiter, authRoutes);

app.use(`${API_PREFIX}/company`, companyRoutes);
app.use(`${API_PREFIX}/movies`, movieRoutes);
app.use(`${API_PREFIX}/news`, newsRoutes);
app.use(`${API_PREFIX}/team`, teamRoutes);
app.use(`${API_PREFIX}/licensing`, licensingRoutes);
app.use(`${API_PREFIX}/marketing`, marketingRoutes);
app.use(`${API_PREFIX}/navigation`, navigationRoutes);
app.use(`${API_PREFIX}/upload`, uploadRoutes);
app.use(`${API_PREFIX}/settings`, settingsRoutes);
app.use(`${API_PREFIX}/messages`, messagesRoutes);
app.use(`${API_PREFIX}/seo`, seoRoutes);
app.use(`${API_PREFIX}/careers`, careersRoutes);
app.use(`${API_PREFIX}/job-applications`, jobApplicationsRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${API_PREFIX}/feed`, feedRoutes);

// Health check endpoint
app.get(`${API_PREFIX}/health`, (req, res) => {
  res.json({
    success: true,
    message: 'WHITE PANDA CREATIONS API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'WHITE PANDA CREATIONS API',
    version: '1.0.0',
    description: 'Backend API for WHITE PANDA CREATIONS content management',
    documentation: `${API_PREFIX}/docs`
  });
});

// Sitemap generator
const sitemapRoutes = require('./routes/sitemap');
app.use('/sitemap.xml', sitemapRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: messages
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `Duplicate value for field: ${field}`
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  // Default error
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║                                                  ║
  ║   🐼 WHITE PANDA CREATIONS API Server            ║
  ║                                                  ║
  ║   Environment: ${process.env.NODE_ENV?.padEnd(30)}║
  ║   Port: ${PORT.toString().padEnd(39)}║
  ║   API: ${('http://localhost:' + PORT + API_PREFIX).padEnd(40)}║
  ║                                                  ║
  ╚══════════════════════════════════════════════════╝
  `);
});

module.exports = app;
