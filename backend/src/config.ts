import 'dotenv/config';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '..');

export const PORT = Number(process.env.PORT ?? 4000);
export const DATA_DIR = path.resolve(BACKEND_ROOT, process.env.DATA_DIR ?? '../import-data');
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);
export const MAX_BACKUPS_PER_ENTITY = Number(process.env.MAX_BACKUPS_PER_ENTITY ?? 10);
export const TMDB_API_KEY = process.env.TMDB_API_KEY ?? '';

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? '';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
export const VIEWER_USERNAME = process.env.VIEWER_USERNAME ?? '';
export const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD ?? '';
export const JWT_SECRET = process.env.JWT_SECRET ?? '';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '12h';
export const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
export const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

export const BACKUPS_DIR = path.join(DATA_DIR, '_backups');
export const AUDIT_DIR = path.join(DATA_DIR, '_audit');
export const AUDIT_LOG_PATH = path.join(AUDIT_DIR, 'audit-log.jsonl');
export const STAGING_DIR = path.join(DATA_DIR, '_staging');
