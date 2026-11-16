"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const routes_1 = __importDefault(require("./routes"));
const error_middleware_1 = require("./middleware/error.middleware");
const env_1 = require("./config/env");
const rate_limit_middleware_1 = require("./middleware/rate-limit.middleware");
const createApp = () => {
    const app = (0, express_1.default)();
    // Rate Limiting
    app.use(rate_limit_middleware_1.globalRateLimiter);
    // HTTP Security Headers (Task 4)
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'blob:'],
                connectSrc: ["'self'", env_1.ENV.CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
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
    }));
    // Security & Cross-Origin
    app.use((0, cors_1.default)({
        origin: [env_1.ENV.CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['Content-Disposition'],
    }));
    // Parsers
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    app.use((0, cookie_parser_1.default)());
    // Note: Static /uploads directory removed in Phase 4.5 for secure, authenticated document access
    // All documents must now be downloaded via authenticated endpoint: GET /api/school/documents/:id/download
    if (env_1.ENV.NODE_ENV !== 'test') {
        app.use((0, morgan_1.default)('dev'));
    }
    // Health check endpoint
    app.get('/health', (_req, res) => {
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
    app.use('/api', routes_1.default);
    // Fallback for unmatched routes
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            message: `Route not found: ${req.method} ${req.originalUrl}`,
        });
    });
    // Central error handling
    app.use(error_middleware_1.errorHandler);
    return app;
};
exports.createApp = createApp;
