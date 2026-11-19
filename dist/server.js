"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const app_1 = require("./app");
const env_1 = require("./config/env");
const prisma_1 = require("./lib/prisma");
const app = (0, app_1.createApp)();
exports.app = app;
let server;
if (!process.env.VERCEL) {
    server = app.listen(env_1.ENV.PORT, () => {
        console.log(`===============================================`);
        console.log(`🚀 School ERP Backend Server running on port ${env_1.ENV.PORT}`);
        console.log(`🌐 Environment: ${env_1.ENV.NODE_ENV}`);
        console.log(`🔗 API Base URL: http://localhost:${env_1.ENV.PORT}/api`);
        console.log(`===============================================`);
    });
    const gracefulShutdown = async (signal) => {
        console.log(`\nReceived ${signal}. Shutting down gracefully...`);
        server?.close(async () => {
            console.log('HTTP server closed.');
            await prisma_1.prisma.$disconnect();
            console.log('Prisma database client disconnected.');
            process.exit(0);
        });
    };
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}
exports.default = app;
