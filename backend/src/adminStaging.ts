import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import { STAGING_DIR } from './config.js';
import { entities, type EntityDescriptor, type Row } from './entities/index.js';
import { readRows, writeRows, findRowById } from './store.js';
import { appendAuditEntry, diffFields, type ChangedFieldDiff } from './audit.js';
import { findUniqueConflict } from './uniqueness.js';
import { ApiError } from './errors.js';

// The controlled "upload -> review -> apply" pipeline that replaces the old folder-scanning
// auto-import: parsing and validation happen immediately on upload (writes NOTHING), the result
// is held here as a staging session on disk until the admin explicitly applies or discards it.
// Reuses entity.mapRow/schema (normalize.ts), store.ts's uniqueness/FK helpers, and store.ts's
// atomic writeRows — this module only adds the diff/staging/two-phase-commit layer on top.

export type DiffKind = 'insert' | 'update' | 'skip' | 'error';

export interface StagedIssue {
  rowIndex: number;
  field: string | null;
  severity: 'warning' | 'error';
  message: string;
}

export interface StagedRow {
  index: number; // position within the uploaded sheet(s) for this entity, 0-based
  data: Row;
  kind: DiffKind;
  changedFields: string[];
  auditDiff?: Record<string, ChangedFieldDiff>;
}

export interface BatchSummary {
  new: number;
  updated: number;
  unchanged: number;
  warnings: number;
  errors: number;
}

export interface StagedBatch {
  entity: string;
  sourceLabel: string;
  rows: StagedRow[];
  issues: StagedIssue[];
  summary: BatchSummary;
  applied: boolean;
}

export interface StagingSession {
  stagingId: string;
  uploadedAt: string;
  batches: StagedBatch[];
  parseWarnings: string[];
}

export interface ApplyResult {
  entity: string;
  applied: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  blockedByErrors: number;
}

// Sheets are processed in FK-dependency order (trainer before workshop before
// participant/feedback) so a workshop row referencing a brand-new trainer_id uploaded in the
// *same* session is recognized, not flagged as a missing reference.
const ENTITY_PROCESS_ORDER = ['trainers', 'workshops', 'participants', 'feedback'];

const ENTITY_SHEET_ALIASES: Record<string, string[]> = {
  workshops: ['workshops', 'workshop', 'workshop-detail', 'workshop_detail', 'ورش', 'ورشة', 'ورش العمل', 'ورش-العمل'],
  trainers: ['trainers', 'trainer', 'مدربين', 'المدربين', 'مدرب'],
  participants: ['participants', 'participant', 'مشاركين', 'المشاركين', 'مشارك'],
  feedback: ['feedback', 'ratings', 'reviews', 'تقييم', 'التقييمات', 'ملاحظات'],
};

function detectEntityBySheetName(sheetName: string): string | null {
  const normalized = sheetName.trim().toLowerCase();
  for (const [entityName, aliases] of Object.entries(ENTITY_SHEET_ALIASES)) {
    if (aliases.some((a) => a.toLowerCase() === normalized)) return entityName;
  }
  return null;
}

// Falls back to header-overlap scoring for the common case: a per-entity export where the sheet
// is always named "البيانات" and can't disambiguate by name alone. Requires a reasonably strong
// match (40%+ of the entity's canonical columns present) to avoid misclassifying an unrelated
// sheet as the closest-scoring entity.
function detectEntityByHeaders(headers: string[]): string | null {
  const headerSet = new Set(headers.map((h) => String(h).trim()));
  let best: { name: string; score: number } | null = null;
  for (const entity of Object.values(entities)) {
    const canonicalScore = entity.columns.filter((c) => headerSet.has(c)).length / entity.columns.length;
    // A raw external export (e.g. a survey tool's feedback response file) uses its own question
    // text as headers instead of this entity's canonical column names — scored against the
    // alias set's own size (not combined with the canonical columns) so a pure-alias upload can
    // still reach a strong match instead of being diluted by canonical columns it will never hit.
    const aliases = entity.importHeaderAliases ?? [];
    const aliasScore = aliases.length > 0 ? aliases.filter((c) => headerSet.has(c)).length / aliases.length : 0;
    const score = Math.max(canonicalScore, aliasScore);
    if (!best || score > best.score) best = { name: entity.name, score };
  }
  return best && best.score >= 0.4 ? best.name : null;
}

interface ParsedSheet {
  entityName: string;
  sourceLabel: string;
  rows: Row[];
}

function parseUploadedWorkbooks(files: { filename: string; buffer: Buffer }[]): { sheets: ParsedSheet[]; parseWarnings: string[] } {
  const sheets: ParsedSheet[] = [];
  const parseWarnings: string[] = [];

  for (const file of files) {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer' });
    } catch (err) {
      throw new ApiError(422, 'BAD_FILE', `"${file.filename}" could not be read as an Excel workbook: ${(err as Error).message}`);
    }

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
      if (rows.length === 0) continue; // empty/unused sheet (e.g. an instructions tab) — skip silently

      const entityName = detectEntityBySheetName(sheetName) ?? detectEntityByHeaders(Object.keys(rows[0]));
      if (!entityName) {
        parseWarnings.push(`"${file.filename}" sheet "${sheetName}": could not detect which entity this belongs to (checked sheet name and column headers) — skipped.`);
        continue;
      }
      sheets.push({ entityName, sourceLabel: `${file.filename}:${sheetName}`, rows });
    }
  }

  return { sheets, parseWarnings };
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// The "known good" (non-error) ids of every *other* batch already staged in this session, keyed
// by entity — used as the cross-entity FK context when re-validating a single batch in isolation
// (a fix or a bulk workshop assignment), so a participant/feedback row referencing a workshop
// that's staged (but not yet applied) in the same session isn't flagged as a missing reference.
function siblingKnownGoodIds(session: StagingSession, excludeEntity: string): Map<string, Set<string>> {
  const knownGoodIds = new Map<string, Set<string>>();
  for (const other of session.batches) {
    if (other.entity === excludeEntity) continue;
    knownGoodIds.set(
      other.entity,
      new Set(other.rows.filter((r) => r.kind !== 'error').map((r) => String(r.data[entities[other.entity].idField]))),
    );
  }
  return knownGoodIds;
}

function findMatch(entity: EntityDescriptor, rows: Row[], candidate: Row): Row | undefined {
  const byId = rows.find((r) => String(r[entity.idField]) === String(candidate[entity.idField]));
  if (byId) return byId;
  for (const keySet of entity.importFallbackMatch ?? []) {
    if (keySet.some((k) => !candidate[k])) continue;
    const match = rows.find((r) => keySet.every((k) => String(r[k] ?? '') === String(candidate[k] ?? '')));
    if (match) return match;
  }
  return undefined;
}

function computeSummary(rows: StagedRow[], issues: StagedIssue[]): BatchSummary {
  return {
    new: rows.filter((r) => r.kind === 'insert').length,
    updated: rows.filter((r) => r.kind === 'update').length,
    unchanged: rows.filter((r) => r.kind === 'skip').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    errors: issues.filter((i) => i.severity === 'error').length,
  };
}

// Validates + diffs one entity's rows against current master data (mirroring the established
// per-row pipeline from the old routes/importRoute.ts: mapRow -> schema.safeParse -> FK check ->
// id/fallback-key match -> uniqueness/diff), but stages the result instead of writing it.
// `knownGoodIds` carries ids already known-good from sibling batches processed earlier in this
// same session/apply call (for cross-entity FK checks against not-yet-committed rows), and is
// updated in place with this batch's own good ids so entities processed *after* this one see them.
async function buildBatch(
  entity: EntityDescriptor,
  sourceRows: Row[],
  sourceLabel: string,
  knownGoodIds: Map<string, Set<string>>,
): Promise<StagedBatch & { finalRows: Row[] }> {
  const currentRows = await readRows(entity);
  const workingRows = [...currentRows];
  const stagedRows: StagedRow[] = [];
  const issues: StagedIssue[] = [];
  const goodIds = new Set<string>();

  for (let i = 0; i < sourceRows.length; i++) {
    const raw = sourceRows[i];
    const { row: mapped, warnings } = entity.mapRow(raw);
    for (const w of warnings) issues.push({ rowIndex: i, field: null, severity: 'warning', message: w });

    const parsed = entity.schema.safeParse(mapped);
    if (!parsed.success) {
      for (const iss of parsed.error.issues) {
        issues.push({ rowIndex: i, field: iss.path.join('.') || null, severity: 'error', message: iss.message });
      }
      stagedRows.push({ index: i, data: mapped, kind: 'error', changedFields: [] });
      continue;
    }
    const candidate = parsed.data as Row;

    let fkFailed = false;
    for (const rule of entity.fk ?? []) {
      const value = candidate[rule.field];
      if (value === null || value === undefined || value === '') continue;
      const strValue = String(value);
      const inDb = await findRowById(entities[rule.targetEntity], strValue);
      const inSession = knownGoodIds.get(rule.targetEntity)?.has(strValue);
      if (!inDb && !inSession) {
        issues.push({
          rowIndex: i,
          field: rule.field,
          severity: 'error',
          message: `${rule.field} "${strValue}" does not reference an existing ${rule.targetEntity} record`,
        });
        fkFailed = true;
      }
    }

    // Matched only against rows that existed *before* this batch started (never against a
    // sibling row inserted earlier in this same loop) — the id/fallback-key match means "this
    // incoming row is the same pre-existing record" (e.g. a re-export that reassigned
    // participant_id but kept the same national_id/email), which is a legitimate update. Two
    // rows *within the same upload* sharing a national_id/email is a different situation — a
    // likely data-entry duplicate — and must fall through to the uniqueness check below instead
    // of silently merging into one record.
    const existing = findMatch(entity, currentRows, candidate);

    if (!existing) {
      const conflict = findUniqueConflict(entity, workingRows, candidate);
      if (conflict) {
        issues.push({
          rowIndex: i,
          field: conflict.keys.join('+'),
          severity: 'error',
          message: `Duplicate ${conflict.keys.join(' + ')} within the uploaded data / existing data`,
        });
        stagedRows.push({ index: i, data: candidate, kind: 'error', changedFields: [] });
        continue;
      }
      if (fkFailed) {
        stagedRows.push({ index: i, data: candidate, kind: 'error', changedFields: [] });
        continue;
      }
      const inserted: Row = { ...candidate, deleted_at: null };
      workingRows.push(inserted);
      goodIds.add(String(inserted[entity.idField]));
      stagedRows.push({ index: i, data: inserted, kind: 'insert', changedFields: [], auditDiff: diffFields(null, inserted) });
      continue;
    }

    if (fkFailed) {
      stagedRows.push({ index: i, data: candidate, kind: 'error', changedFields: [] });
      continue;
    }

    // Preserve the existing row's own id when matched via a fallback key with a different id
    // value (e.g. a re-export changed participant_id but national_id/email still match). A match
    // against a *soft-deleted* row revives it — an admin applying a batch that re-asserts that
    // record's data is explicitly choosing to bring it back, the same as the brand-new-row path
    // above always inserting live (deleted_at: null). Otherwise a record deleted once could never
    // be reintroduced by a later legitimate import that happens to share its fallback key (e.g.
    // the same survey response id re-exported for the correct workshop after a bad first import
    // was cleaned up).
    const finalCandidate: Row = { ...candidate, [entity.idField]: existing[entity.idField], deleted_at: null };
    const changed = diffFields(existing, finalCandidate);
    const changedKeys = Object.keys(changed);
    goodIds.add(String(finalCandidate[entity.idField]));

    if (changedKeys.length === 0) {
      stagedRows.push({ index: i, data: finalCandidate, kind: 'skip', changedFields: [] });
      continue;
    }

    const idx = workingRows.findIndex((r) => r === existing);
    workingRows[idx] = finalCandidate;
    stagedRows.push({ index: i, data: finalCandidate, kind: 'update', changedFields: changedKeys, auditDiff: changed });
  }

  knownGoodIds.set(entity.name, goodIds);

  return {
    entity: entity.name,
    sourceLabel,
    rows: stagedRows,
    issues,
    summary: computeSummary(stagedRows, issues),
    applied: false,
    finalRows: workingRows,
  };
}

function stagingFilePath(stagingId: string): string {
  return path.join(STAGING_DIR, `${stagingId}.json`);
}

async function saveStagingSession(session: StagingSession): Promise<void> {
  await fs.promises.mkdir(STAGING_DIR, { recursive: true });
  await fs.promises.writeFile(stagingFilePath(session.stagingId), JSON.stringify(session, null, 2), 'utf-8');
}

export async function loadStagingSession(stagingId: string): Promise<StagingSession> {
  try {
    const buf = await fs.promises.readFile(stagingFilePath(stagingId), 'utf-8');
    return JSON.parse(buf) as StagingSession;
  } catch {
    throw new ApiError(404, 'STAGING_NOT_FOUND', `No staged upload with id "${stagingId}" — it may have expired or already been applied/discarded.`);
  }
}

export async function discardStagingSession(stagingId: string): Promise<void> {
  await loadStagingSession(stagingId); // validates existence, throws 404 otherwise
  await fs.promises.unlink(stagingFilePath(stagingId)).catch(() => {});
}

// Step 1: parse + validate + diff every uploaded file, writing nothing. Sheets belonging to the
// same entity (e.g. two participant files uploaded together) are merged into one batch.
export async function createStagingSession(files: { filename: string; buffer: Buffer }[]): Promise<StagingSession> {
  const { sheets, parseWarnings } = parseUploadedWorkbooks(files);
  if (sheets.length === 0) {
    throw new ApiError(422, 'BAD_FILE', parseWarnings.length > 0 ? parseWarnings.join(' ') : 'No recognizable workshop/trainer/participant/feedback data found in the uploaded file(s).');
  }

  const rowsByEntity = new Map<string, { rows: Row[]; sourceLabels: string[] }>();
  for (const sheet of sheets) {
    const bucket = rowsByEntity.get(sheet.entityName) ?? { rows: [], sourceLabels: [] };
    // A raw post-workshop feedback export (Google Forms, a survey tool, etc.) has no internal
    // feedback_id — it's an administrative id this system assigns, not something a coordinator
    // would fill in. Stamped once here (at first upload) rather than in mapFeedbackRow, which
    // must stay a pure/idempotent normalizer since store.ts re-runs it on every read — an id
    // generated there would churn on every server restart instead of staying stable.
    const rows = sheet.entityName === 'feedback' ? sheet.rows.map((r) => (r.feedback_id ? r : { ...r, feedback_id: generateId('FB') })) : sheet.rows;
    bucket.rows.push(...rows);
    bucket.sourceLabels.push(sheet.sourceLabel);
    rowsByEntity.set(sheet.entityName, bucket);
  }

  const knownGoodIds = new Map<string, Set<string>>();
  const batches: StagedBatch[] = [];
  for (const entityName of ENTITY_PROCESS_ORDER) {
    const bucket = rowsByEntity.get(entityName);
    if (!bucket) continue;
    const { finalRows: _finalRows, ...batch } = await buildBatch(entities[entityName], bucket.rows, bucket.sourceLabels.join(', '), knownGoodIds);
    batches.push(batch);
  }

  const session: StagingSession = { stagingId: randomUUID(), uploadedAt: new Date().toISOString(), batches, parseWarnings };
  await saveStagingSession(session);
  return session;
}

// Step 2a: re-validate one edited row against the rest of its batch (and sibling batches in the
// same session) live, without touching any master file. Re-runs the *whole* batch's validation
// (not just the one row) so a fix that resolves a duplicate/reference conflict with another
// staged row clears both rows' errors, not just the edited one.
export async function patchStagingRow(stagingId: string, entityName: string, rowIndex: number, patch: Row): Promise<StagedBatch> {
  const session = await loadStagingSession(stagingId);
  const entity = entities[entityName];
  if (!entity) throw new ApiError(404, 'NOT_FOUND', `Unknown entity "${entityName}"`);

  const batchIndex = session.batches.findIndex((b) => b.entity === entityName);
  if (batchIndex === -1) throw new ApiError(404, 'NOT_FOUND', `No staged batch for entity "${entityName}" in this session`);
  const batch = session.batches[batchIndex];
  if (!batch.rows.some((r) => r.index === rowIndex)) {
    throw new ApiError(404, 'NOT_FOUND', `No staged row at index ${rowIndex} for entity "${entityName}"`);
  }

  const updatedSourceRows = batch.rows.map((r) => (r.index === rowIndex ? { ...r.data, ...patch } : r.data));

  const knownGoodIds = siblingKnownGoodIds(session, entityName);
  const { finalRows: _finalRows, ...rebuilt } = await buildBatch(entity, updatedSourceRows, batch.sourceLabel, knownGoodIds);
  session.batches[batchIndex] = rebuilt;
  await saveStagingSession(session);
  return rebuilt;
}

// Bulk-assigns every row in a batch to the same workshop — for feedback (and participant) files
// collected per-workshop outside the system (a paper form, a survey tool export) that carry no
// workshop_id column at all. The admin picks the workshop once in the UI instead of having to
// fix every row's workshop_id individually.
export async function setBatchWorkshopId(stagingId: string, entityName: string, workshopId: string): Promise<StagedBatch> {
  const session = await loadStagingSession(stagingId);
  const entity = entities[entityName];
  if (!entity) throw new ApiError(404, 'NOT_FOUND', `Unknown entity "${entityName}"`);
  if (!entity.fk?.some((rule) => rule.field === 'workshop_id')) {
    throw new ApiError(400, 'BAD_REQUEST', `${entityName} rows are not scoped to a workshop`);
  }

  const batchIndex = session.batches.findIndex((b) => b.entity === entityName);
  if (batchIndex === -1) throw new ApiError(404, 'NOT_FOUND', `No staged batch for entity "${entityName}" in this session`);
  const batch = session.batches[batchIndex];

  const updatedSourceRows = batch.rows.map((r) => ({ ...r.data, workshop_id: workshopId }));

  const knownGoodIds = siblingKnownGoodIds(session, entityName);
  const { finalRows: _finalRows, ...rebuilt } = await buildBatch(entity, updatedSourceRows, batch.sourceLabel, knownGoodIds);
  session.batches[batchIndex] = rebuilt;
  await saveStagingSession(session);
  return rebuilt;
}

// Step 2b: commit. Each batch is re-validated fresh against current master data immediately
// before writing it (data may have shifted since staging was created) — a batch with remaining
// blocking errors is skipped (not applied) without aborting sibling batches, and the session
// stays around (with the fresh re-validation persisted) so the admin can fix and retry just that
// batch. A locked target file aborts the whole call (batches already written in this same call
// stay written — that can't be undone — but nothing further is attempted); the session is saved
// with whatever progress was made before the error propagates as a 423.
export async function applyStagingSession(stagingId: string, entityFilter?: string[]): Promise<{ results: ApplyResult[]; sessionDiscarded: boolean }> {
  const session = await loadStagingSession(stagingId);
  const targets = new Set(entityFilter ?? session.batches.map((b) => b.entity));
  const orderedTargets = ENTITY_PROCESS_ORDER.filter((e) => targets.has(e) && session.batches.some((b) => b.entity === e));
  if (orderedTargets.length === 0) throw new ApiError(404, 'NOT_FOUND', 'No matching staged batches to apply');

  const results: ApplyResult[] = [];
  const knownGoodIds = new Map<string, Set<string>>();
  // Batches not targeted this call, but already staged as error-free from a prior pass, still
  // count as known-good for FK purposes (their ids will exist once applied separately).
  for (const b of session.batches) {
    if (!orderedTargets.includes(b.entity)) {
      knownGoodIds.set(b.entity, new Set(b.rows.filter((r) => r.kind !== 'error').map((r) => String(r.data[entities[b.entity].idField]))));
    }
  }

  try {
    for (const entityName of orderedTargets) {
      const batchIndex = session.batches.findIndex((b) => b.entity === entityName);
      const batch = session.batches[batchIndex];
      const entity = entities[entityName];

      const rebuilt = await buildBatch(entity, batch.rows.map((r) => r.data), batch.sourceLabel, knownGoodIds);

      if (rebuilt.summary.errors > 0) {
        session.batches[batchIndex] = { ...rebuilt, applied: false };
        results.push({ entity: entityName, applied: false, inserted: 0, updated: 0, skipped: rebuilt.summary.unchanged, blockedByErrors: rebuilt.summary.errors });
        continue;
      }

      await writeRows(entity, rebuilt.finalRows);
      for (const r of rebuilt.rows) {
        if (r.kind === 'insert' || r.kind === 'update') {
          appendAuditEntry({
            entity: entityName,
            record_id: String(r.data[entity.idField]),
            action: r.kind === 'insert' ? 'create' : 'update',
            changed_fields: r.auditDiff ?? {},
            source: 'admin-upload',
            source_detail: batch.sourceLabel,
            actor: null,
          });
        }
      }

      session.batches[batchIndex] = { ...rebuilt, applied: true };
      results.push({ entity: entityName, applied: true, inserted: rebuilt.summary.new, updated: rebuilt.summary.updated, skipped: rebuilt.summary.unchanged, blockedByErrors: 0 });
    }
  } finally {
    const allApplied = session.batches.every((b) => b.applied);
    if (allApplied) {
      await discardStagingSession(stagingId).catch(() => {});
    } else {
      await saveStagingSession(session);
    }
  }

  return { results, sessionDiscarded: session.batches.every((b) => b.applied) };
}
