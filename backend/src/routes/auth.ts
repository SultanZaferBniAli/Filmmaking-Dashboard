import * as crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ADMIN_USERNAME, ADMIN_PASSWORD, VIEWER_USERNAME, VIEWER_PASSWORD, JWT_EXPIRES_IN, COOKIE_SECURE } from '../config.js';
import { signSession, requireAuth, type Role } from '../auth.js';
import { ApiError, zodToApiError } from '../errors.js';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const durationUnitSeconds: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

// Turns a jwt-style duration ("12h", "30m", "7d") into seconds for the cookie's maxAge, so the
// cookie and the JWT it carries always expire together without hardcoding the unit twice.
function durationToSeconds(input: string): number {
  const match = /^(\d+)([smhd])$/.exec(input.trim());
  if (!match) return Number(input) || 43200; // fall back to 12h if unparseable
  return Number(match[1]) * durationUnitSeconds[match[2]];
}

// Constant-time string comparison — avoids leaking how many leading characters of the expected
// username/password matched via response-time differences.
function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function matchAccount(username: string, password: string): Role | null {
  if (ADMIN_USERNAME && timingSafeStringEqual(username, ADMIN_USERNAME) && timingSafeStringEqual(password, ADMIN_PASSWORD)) {
    return 'admin';
  }
  if (VIEWER_USERNAME && timingSafeStringEqual(username, VIEWER_USERNAME) && timingSafeStringEqual(password, VIEWER_PASSWORD)) {
    return 'viewer';
  }
  return null;
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw zodToApiError(parsed.error);

    const role = matchAccount(parsed.data.username, parsed.data.password);
    if (!role) throw new ApiError(401, 'INVALID_CREDENTIALS', 'اسم المستخدم أو كلمة المرور غير صحيحة');

    reply.setCookie('session', signSession(role), {
      httpOnly: true,
      sameSite: 'lax',
      secure: COOKIE_SECURE,
      path: '/',
      maxAge: durationToSeconds(JWT_EXPIRES_IN),
    });
    return { role };
  });

  app.post('/auth/logout', async (_req, reply) => {
    reply.clearCookie('session', { path: '/' });
    reply.code(204);
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (req) => {
    return { role: req.userRole };
  });
}
