import type { z } from 'zod';

export type Row = Record<string, unknown>;

export type MapRowResult = { row: Row; warnings: string[] };

export interface EntityDescriptor {
  name: string; // 'workshops' | 'trainers' | 'participants' | 'feedback'
  // Folder under DATA_DIR holding this entity's one master workbook (e.g. 'trainers' ->
  // import-data/trainers/trainers.xlsx) — the actual workbook filename inside it is resolved
  // dynamically at read/write time, since these source files get renamed from time to time
  // (observed: "2_Trainers.xlsx" -> "trainers.xlsx") and hardcoding an exact name would silently
  // break the moment that happens again.
  folder: string;
  idField: string; // primary key column name
  columns: string[]; // canonical header order (deleted_at is appended automatically)
  schema: z.ZodTypeAny; // validates a fully-normalized row (create path)
  // Normalizes a raw sheet/payload row (messy Excel values or an API payload) into the clean
  // shape `schema` expects, plus any non-fatal warnings (unmappable city, corrupted phone, etc).
  mapRow: (raw: Row) => MapRowResult;
  uniqueKeys: string[][]; // e.g. [['workshop_id']], or compound like ['workshop_id','email']
  // Compound keys only checked when every field in the tuple is non-null (e.g. national_id
  // is optional, so its uniqueness only matters among rows that actually have one).
  uniqueKeysWhenPresent?: string[][];
  fk?: { field: string; targetEntity: string }[];
  restrictDeleteIfReferencedBy?: { entity: string; field: string }[];
  // Attachment (document, e.g. CV/passport — not photos, those go through the dedicated admin
  // photo routes) storage location. A fixed relative path under DATA_DIR, or a function
  // resolving a per-row path (e.g. participants, keyed by the row's own participant_id).
  attachmentsDir?: string | ((row: Row) => Promise<string>);
  // Alternate match keys tried (in order) during import upsert when the primary id isn't found.
  importFallbackMatch?: string[][];
  // Extra header strings (beyond `columns`) that identify an uploaded sheet as belonging to this
  // entity when the sheet name itself doesn't match one of ENTITY_SHEET_ALIASES — e.g. a raw
  // external survey-tool export whose column headers are literal question text, not this
  // entity's canonical column names (see feedbackEntity, and adminStaging.ts's
  // detectEntityByHeaders).
  importHeaderAliases?: string[];
}
