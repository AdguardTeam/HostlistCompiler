import type { Config } from '@prisma/client';
import process from 'node:process';

const config: Config = {
    datasourceUrl: process.env.DATABASE_URL || 'file:./dev.db',
};

export default config;
