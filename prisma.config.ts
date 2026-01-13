import type { Config } from '@prisma/client';

const config: Config = {
  datasourceUrl: process.env.DATABASE_URL || 'file:./dev.db',
};

export default config;
