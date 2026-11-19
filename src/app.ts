import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { ENV } from './config/env';
import { globalRateLimiter } from './middleware/rate-limit.middleware';

export const createApp = (): Application => {
  const app = express();

  // Rate Limiting
  app.use(globalRateLimiter);

  // HTTP Security Headers (Task 4)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", ENV.CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:3000', 'https://*.vercel.app'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
    })
  );

  // Security & Cross-Origin
  const allowedOrigins = [
    ENV.CLIENT_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          origin.endsWith('.vercel.app') ||
          origin.startsWith('http://localhost:')
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Disposition'],
    })
  );

  // Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Note: Static /uploads directory removed in Phase 4.5 for secure, authenticated document access
  // All documents must now be downloaded via authenticated endpoint: GET /api/school/documents/:id/download

  if (ENV.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      service: 'School ERP Multi-Tenant API',
      timestamp: new Date().toISOString(),
      security: {
        rateLimiting: 'Active',
        refreshTokenRotation: 'Active',
        tenantIsolation: 'Active',
        httpSecurityHeaders: 'Active',
        secureDocumentStorage: 'Active',
        cookieAuthentication: 'Active',
      },
    });
  });

  // Mount API v1 routes
  app.use('/api', routes);

  // Fallback for unmatched routes
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Central error handling
  app.use(errorHandler);

  return app;
};
