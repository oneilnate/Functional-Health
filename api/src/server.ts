import Fastify, { type FastifyError } from 'fastify';
import { env } from './env.js';
import { bearerAuthPlugin } from './middleware/auth.js';
import { meRoutes } from './routes/me.js';

const server = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

// ── Error handler ────────────────────────────────────────────────────────────
server.setErrorHandler((error: FastifyError, _request, reply) => {
  server.log.error({ err: error }, 'Unhandled error');
  const statusCode = error.statusCode ?? 500;
  reply.status(statusCode).send({
    error: error.name ?? 'InternalServerError',
    message: error.message ?? 'An unexpected error occurred',
    statusCode,
  });
});

// ── Auth middleware (global, guards /api/* routes) ──────────────────────────
await server.register(bearerAuthPlugin);

// ── Routes ───────────────────────────────────────────────────────────────────
server.get('/health', async (_request, _reply) => {
  return { status: 'ok', uptime: process.uptime() };
});

await server.register(meRoutes);

// ── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
  server.log.info({ signal }, 'Received shutdown signal — closing server');
  try {
    await server.close();
    server.log.info('Server closed cleanly');
    process.exit(0);
  } catch (err) {
    server.log.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

// ── Start ────────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    server.log.error({ err }, 'Failed to start server');
    process.exit(1);
  }
};

void start();
