import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../env.js';

/**
 * Demo user attached to every authenticated request.
 * Single-user demo mode — no multi-tenancy.
 */
export interface AuthUser {
  id: string;
  email: string;
}

// Extend Fastify's request interface to include `user`
declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser;
  }
}

/**
 * bearerAuthPlugin
 *
 * Fastify plugin (wrapped with fastify-plugin so the hook is not encapsulated)
 * that validates `Authorization: Bearer <token>` against
 * `env.DEMO_USER_BEARER_TOKEN`. Registers a global `onRequest` hook that
 * guards all routes under the `/api/` prefix.
 *
 * On success: attaches `request.user = { id, email }` (demo user).
 * On failure: returns 401 `{ error, code }` per the locked error shape.
 */
async function _bearerAuthPlugin(fastify: FastifyInstance): Promise<void> {
  // Decorate every request with a placeholder so TypeScript is happy
  // before the hook runs. The hook overwrites it for authenticated requests.
  // Decorate with a getter+setter pair so Fastify v5 creates a writable
  // property. The hook overwrites it per-request for any /api/* hit.
  fastify.decorateRequest<AuthUser>('user', {
    getter() {
      return { id: '', email: '' };
    },
    setter(value: AuthUser) {
      // Fastify replaces the per-instance value; this no-op satisfies the type.
      void value;
    },
  });

  fastify.addHook(
    'onRequest',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      // Only guard routes under /api/*
      if (!request.url.startsWith('/api/')) {
        return;
      }

      const authHeader = request.headers['authorization'];

      if (!authHeader) {
        return void reply.status(401).send({
          error: 'unauthorized',
          code: 'AUTH_MISSING_TOKEN',
        });
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
        return void reply.status(401).send({
          error: 'unauthorized',
          code: 'AUTH_MISSING_TOKEN',
        });
      }

      const token = parts[1];

      if (token !== env.DEMO_USER_BEARER_TOKEN) {
        return void reply.status(401).send({
          error: 'unauthorized',
          code: 'AUTH_INVALID_TOKEN',
        });
      }

      // Attach demo user to request
      request.user = {
        id: 'usr_demo_01',
        email: 'demo@pear.everbetter.com',
      };
    },
  );
}

/**
 * Export wrapped with fastify-plugin so Fastify does NOT create a new scope.
 * This makes the `onRequest` hook — and the `user` decoration — available
 * globally to all routes registered in any scope.
 */
export const bearerAuthPlugin = fp(_bearerAuthPlugin, {
  name: 'bearer-auth',
});

