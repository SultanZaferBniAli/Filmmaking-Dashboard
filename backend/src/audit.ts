import * as fs from 'node:fs';
import * as path from 'node:path';
import { AUDIT_DIR, AUDIT_LOG_PATH } from './config.js';

export type AuditAction = 'create' | 'update' | 'delete' | 'restore';
export type AuditSource = 'excel-import' | 'dashboard-edit' | 'api' | 'admin-upload';

export interface ChangedFieldDiff {
  before: unknown;
  after: unknown;
}

export interface AuditEntry {
  timestamp: string;
  entity: string;
  record_id: string;
  action: AuditAction;
  changed_fields: Record<string, ChangedFieldDiff>;
  source: AuditSource;
  source_detail: string | null;
  actor: string | null;
}

function ensureAuditDir() {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

export function appendAuditEntry(entry: Omit<AuditEntry, 'timestamp'>): AuditEntry {
  ensureAuditDir();
  const full: AuditEntry = { timestamp: new Date().toISOString(), ...entry };
  fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify(full) + '\n', 'utf-8');
  return full;
}

export function readAuditHistory(entity: string, recordId: string): AuditEntry[] {
  if (!fs.existsSync(AUDIT_LOG_PATH)) return [];
  const lines = fs.readFileSync(AUDIT_LOG_PATH, 'utf-8').split('\n').filter((l) => l.trim() !== '');
  const entries: AuditEntry[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as AuditEntry;
      if (parsed.entity === entity && parsed.record_id === recordId) entries.push(parsed);
    } catch {
      // Skip a malformed line rather than failing the whole history read.
    }
  }
  return entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// Computes only the fields that actually changed between two rows, for field-level audit
// entries (a single-field PATCH logs only that field).
export function diffFields(before: Record<string, unknown> | null, after: Record<string, unknown>): Record<string, ChangedFieldDiff> {
  const changed: Record<string, ChangedFieldDiff> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);
  for (const key of keys) {
    const beforeValue = before ? before[key] : undefined;
    const afterValue = after[key];
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changed[key] = { before: beforeValue ?? null, after: afterValue ?? null };
    }
  }
  return changed;
}

export function auditLogPathForTest(): string {
  return path.resolve(AUDIT_LOG_PATH);
}
