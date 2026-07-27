import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from './config.js';
import { ApiError } from './errors.js';

export type Role = 'admin' | 'viewer';

declare module 'fastify' {
  interface FastifyRequest {
    userRole?: Role;
  }
}

type SessionPayload = { role: Role };

export function signSession(role: Role): string {
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign({ role } satisfies SessionPayload, JWT_SECRET, options);
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'object' && decoded !== null && (decoded.role === 'admin' || decoded.role === 'viewer')) {
      return { role: decoded.role as Role };
    }
    return null;
  } catch {
    return null;
  }
}

function sessionFromRequest(req: FastifyRequest): SessionPayload | null {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const token = cookies?.session;
  return token ? verifySession(token) : null;
}

// preHandler for any route that requires a logged-in user, admin or viewer.
export async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const session = sessionFromRequest(req);
  if (!session) throw new ApiError(401, 'UNAUTHENTICATED', 'يجب تسجيل الدخول');
  req.userRole = session.role;
}

// preHandler for any route that mutates data — only the admin account may proceed.
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(req, reply);
  if (req.userRole !== 'admin') throw new ApiError(403, 'FORBIDDEN', 'هذا الإجراء يتطلب صلاحية المدير');
}
