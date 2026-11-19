import { createApp } from './app';
import { ENV } from './config/env';
import { prisma } from './lib/prisma';

const app = createApp();

let server: any;

if (!process.env.VERCEL) {
  server = app.listen(ENV.PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 School ERP Backend Server running on port ${ENV.PORT}`);
    console.log(`🌐 Environment: ${ENV.NODE_ENV}`);
    console.log(`🔗 API Base URL: http://localhost:${ENV.PORT}/api`);
    console.log(`===============================================`);
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server?.close(async () => {
      console.log('HTTP server closed.');
      await prisma.$disconnect();
      console.log('Prisma database client disconnected.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

export { app };
export default app;

