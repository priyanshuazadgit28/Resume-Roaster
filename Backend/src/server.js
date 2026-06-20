const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const env = require('./config/env');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Routers
const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const resumesRouter = require('./routes/resumes');
const dashboardRouter = require('./routes/dashboard');
const insightsRouter = require('./routes/insights');
const versionsRouter = require('./routes/versions');
const historyRouter = require('./routes/history');

const app = express();

// Trust proxy for secure cookies and rate limiting behind a reverse proxy
app.set('trust proxy', 1);

// Configure CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin || env.clientOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // required for cookie-based auth
  })
);

// Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Logging in development
if (!env.isProd) {
  app.use(morgan('dev'));
}

// Mount routers
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/resumes', resumesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/versions', versionsRouter);
app.use('/api/history', historyRouter);

// Error handlers
app.use(notFound);
app.use(errorHandler);

// Start server
const start = async () => {
  try {
    await connectDB();
    const server = app.listen(env.port, () => {
      console.log(`Server listening on http://localhost:${env.port}`);
    });

    // Unhandled rejection listener
    process.on('unhandledRejection', (err) => {
      console.error('Unhandled Rejection:', err);
      // close server & exit process
      server.close(() => process.exit(1));
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();
