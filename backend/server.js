import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { query } from './db.js';
import { initializeQueryLoader } from './db/queryLoader.js';

// Import routes
import patientsRoutes from './routes/patients.js';
import providersRoutes from './routes/providers.js';
import insurersRoutes from './routes/insurers.js';
import authorizationsRoutes from './routes/authorizations.js';
import eligibilityRoutes from './routes/eligibility.js';
import claimsRoutes from './routes/claims.js';
import claimBatchesRoutes from './routes/claimBatches.js';
import paymentsRoutes from './routes/payments.js';
import dashboardRoutes from './routes/dashboard.js';
import responseViewerRoutes from './routes/responseViewer.js';
import standardApprovalsRoutes from './routes/standardApprovals.js';
import dentalApprovalsRoutes from './routes/dentalApprovals.js';
import eyeApprovalsRoutes from './routes/eyeApprovals.js';
import aiValidationRoutes from './routes/aiValidation.js';
import medicinesRoutes from './routes/medicines.js';
import generalRequestValidationRoutes from './routes/generalRequestValidation.js';
import generalRequestsRoutes from './routes/generalRequests.js';
import medicationSafetyRoutes from './routes/medicationSafety.js';
import chatRoutes from './routes/chat.js';
import nphiesCodesRoutes from './routes/nphiesCodes.js';
import priorAuthorizationsRoutes from './routes/priorAuthorizations.js';
import claimSubmissionsRoutes from './routes/claimSubmissions.js';
import paymentReconciliationRoutes from './routes/paymentReconciliation.js';
import coveragesRoutes from './routes/coverages.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8001;

// Security middleware
app.use(helmet());

// CORS configuration (must be before rate limiting)
// CORS configuration (FIXED)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175'
    ];

app.use(cors({
  origin: function (origin, callback) {
    // Allow server-to-server, Postman, curl
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));


// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000, // limit each IP to 10000 requests per windowMs (increased for development)
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/providers', providersRoutes);
app.use('/api/insurers', insurersRoutes);
app.use('/api/authorizations', authorizationsRoutes);
app.use('/api/eligibility', eligibilityRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/api/claim-batches', claimBatchesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/response-viewer', responseViewerRoutes);
app.use('/api/standard-approvals', standardApprovalsRoutes);
app.use('/api/dental-approvals', dentalApprovalsRoutes);
app.use('/api/eye-approvals', eyeApprovalsRoutes);
app.use('/api/ai-validation', aiValidationRoutes);
app.use('/api/medicines', medicinesRoutes);
app.use('/api/general-request', generalRequestValidationRoutes);
app.use('/api/general-requests', generalRequestsRoutes);
app.use('/api/medication-safety', medicationSafetyRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/nphies-codes', nphiesCodesRoutes);
app.use('/api/prior-authorizations', priorAuthorizationsRoutes);
app.use('/api/claim-submissions', claimSubmissionsRoutes);
app.use('/api/payment-reconciliation', paymentReconciliationRoutes);
app.use('/api/coverages', coveragesRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Nafes Healthcare Management System API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      patients: '/api/patients',
      providers: '/api/providers',
      insurers: '/api/insurers',
      authorizations: '/api/authorizations',
      eligibility: '/api/eligibility',
      claims: '/api/claims',
      claimBatches: '/api/claim-batches',
      payments: '/api/payments',
      dashboard: '/api/dashboard/stats',
      standardApprovals: '/api/standard-approvals',
      dentalApprovals: '/api/dental-approvals',
      eyeApprovals: '/api/eye-approvals',
      aiValidation: '/api/ai-validation',
      medicines: '/api/medicines',
      medicineSearch: '/api/medicines/search',
      generalRequest: '/api/general-request',
      medicationSafety: '/api/medication-safety',
      generalRequestValidate: '/api/general-request/validate',
      chat: '/api/chat',
      chatHealth: '/api/chat/health',
      priorAuthorizations: '/api/prior-authorizations',
      claimSubmissions: '/api/claim-submissions',
      paymentReconciliation: '/api/payment-reconciliation',
      coverages: '/api/coverages',
      health: '/health'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /api/patients',
      'GET /api/providers',
      'GET /api/insurers',
      'GET /api/authorizations',
      'GET /api/eligibility',
      'GET /api/claims',
      'GET /api/claim-batches',
      'GET /api/payments',
      'GET /api/dashboard/stats',
      'GET /api/standard-approvals',
      'GET /api/dental-approvals',
      'GET /api/eye-approvals'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  // Handle specific error types
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'The request body contains invalid JSON'
    });
  }
  
  if (error.code === '23505') { // Unique constraint violation
    return res.status(409).json({
      error: 'Duplicate entry',
      message: 'A record with this information already exists'
    });
  }
  
  if (error.code === '23503') { // Foreign key constraint violation
    return res.status(400).json({
      error: 'Invalid reference',
      message: 'The referenced record does not exist'
    });
  }
  
  // Default error response
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize dynamic query loader
  await initializeQueryLoader();
});

export default app;
