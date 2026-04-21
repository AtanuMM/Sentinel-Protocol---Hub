import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'node:fs';
import path from 'node:path';
import { secretRoutes } from '@/routes/secretRoutes';
// 1. Environment Detection
const isProd = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

// 2. HTTPS Options
// In Prod/Staging, we expect paths to SSL certificates in Env Vars
const getHttpsOptions = () => {
  if (!isProd) return null;

  try {
    return {
      key: fs.readFileSync(process.env.SSL_KEY_PATH || ''),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH || ''),
    };
  } catch (error) {
    console.error("Failed to load SSL certificates:", error);
    return null; // Fallback to HTTP or handle as fatal error
  }
};

const fastify = Fastify({
  logger: true,
  https: getHttpsOptions(), // Automatically applies HTTPS if options exist
});

const startServer = async () => {
  try {
    // 3. Centralized Key Validation
    const masterKey = process.env.MASTER_ROOT_KEY;
    if (!masterKey || masterKey.length !== 64) {
      fastify.log.error('FATAL: MASTER_ROOT_KEY must be 64-char hex string.');
      process.exit(1);
    }

    await fastify.register(cors, { 
      origin: isProd ? process.env.ALLOWED_ORIGIN : true 
    });
    await fastify.register(secretRoutes, { prefix: '/api/v1' });

    // Health Check
    fastify.get('/health', async () => ({
      status: 'Sentinel Vault Online',
      env: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }));

    // 4. Start Server
    const port = Number(process.env.PORT) || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    
    fastify.log.info(`Vault running in ${process.env.NODE_ENV} mode on port ${port}`);

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// 5. Graceful Shutdown (Important for DB connections)
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, closing server...`);
    await fastify.close();
    process.exit(0);
  });
});

startServer();