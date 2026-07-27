import * as crypto from 'node:crypto';
import type { OutgoingHttpHeaders } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from './auth.js';

type Client = { id: string; write: (chunk: string) => void };
const clients = new Map<string, Client>();

const HEARTBEAT_MS = 25000;

// Registers GET /events — one long-lived response per connected browser tab. Both roles may
// connect (gated by requireAuth, not requireAdmin): admins need their own other tabs to update
// too, and viewers are exactly who this feature is for.
export function registerSseRoute(app: FastifyInstance) {
  app.get('/events', { preHandler: requireAuth }, (req, reply) => {
    // Writing straight to the raw response bypasses Fastify's normal reply pipeline, which is
    // also where @fastify/cors's onRequest hook queues the Access-Control-* headers (via
    // reply.header(), not applied to the socket until Fastify's own send path runs) — without
    // merging reply.getHeaders() in here, the browser's EventSource silently fails as a blocked
    // cross-origin request with no headers at all.
    // Fastify's per-header type (string | number | string[]) is broader than Node's raw
    // OutgoingHttpHeaders — safe to widen here since Node stringifies any numeric header value.
    const headers = {
      ...reply.getHeaders(),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    } as OutgoingHttpHeaders;
    reply.raw.writeHead(200, headers);
    reply.raw.write(': connected\n\n');

    const id = crypto.randomUUID();
    clients.set(id, { id, write: (chunk) => reply.raw.write(chunk) });

    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), HEARTBEAT_MS);
    heartbeat.unref();

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(id);
    });
  });
}

// Called once a write to an entity's workbook has actually landed on disk (see the single hook
// point in store.ts) — never on a no-op or a write deferred by a locked file. `entity` is the
// plural entity name (e.g. "workshops") so clients can refetch just that collection.
export function broadcastChange(entity: string): void {
  const payload = `event: change\ndata: ${JSON.stringify({ entity, at: Date.now() })}\n\n`;
  for (const client of clients.values()) {
    client.write(payload);
  }
}
