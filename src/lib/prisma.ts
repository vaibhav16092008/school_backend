import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { ENV } from '../config/env';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const connectionString = ENV.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });

export const prisma =
  global.__prisma ||
  new PrismaClient({
    adapter,
  });

if (ENV.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export * from '../generated/prisma/client';

