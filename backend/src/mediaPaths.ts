import * as fs from 'node:fs';
import * as path from 'node:path';
import { DATA_DIR } from './config.js';

// Single place that resolves where trainer/workshop images and workshop documents live under
// the flat DATA_DIR/{trainers,workshops}/... layout — used by both the admin upload routes and
// the read/serve path (serialize/*.ts, routes/files.ts). Replaces the old per-workshop-folder
// resolver (workshopMedia.ts/workshopRegistry.ts), which required discovering a workshop's own
// folder before anything photo/document-related could be read or written.

export type WorkshopDocKind = 'reports' | 'guides';

function listDirSafe(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function trainerPhotosDir(): string {
  return path.join(DATA_DIR, 'trainers', 'photos');
}

export function workshopPhotosDir(): string {
  return path.join(DATA_DIR, 'workshops', 'photos');
}

export function workshopDocsDir(kind: WorkshopDocKind): string {
  return path.join(DATA_DIR, 'workshops', kind);
}

// One profile photo per trainer, stored as trainers/photos/<trainer_id>.<ext> — the extension
// varies by upload, so this scans for a file starting with "<trainerId>." rather than assuming
// one.
export function findTrainerPhoto(trainerId: string): { filename: string; url: string } | null {
  const match = listDirSafe(trainerPhotosDir()).find((f) => f.startsWith(`${trainerId}.`));
  if (!match) return null;
  return { filename: match, url: `/files/trainers/photos/${encodeURIComponent(match)}` };
}

function parsePhotoIndex(workshopId: string, filename: string): number | null {
  const match = filename.match(new RegExp(`^${escapeRegExp(workshopId)}_(\\d+)\\.[^.]+$`));
  return match ? Number(match[1]) : null;
}

// Workshop gallery photos are stored flat at workshops/photos/<workshop_id>_<n>.<ext> — sorted
// by n so the gallery order is stable regardless of filesystem listing order.
export function listWorkshopPhotos(workshopId: string): { filename: string; index: number; url: string }[] {
  return listDirSafe(workshopPhotosDir())
    .map((filename) => ({ filename, index: parsePhotoIndex(workshopId, filename) }))
    .filter((e): e is { filename: string; index: number } => e.index !== null)
    .sort((a, b) => a.index - b.index)
    .map((e) => ({ ...e, url: `/files/workshops/photos/${encodeURIComponent(e.filename)}` }));
}

export function nextWorkshopPhotoIndex(workshopId: string): number {
  const existing = listWorkshopPhotos(workshopId);
  return existing.length === 0 ? 0 : Math.max(...existing.map((e) => e.index)) + 1;
}

// The workshop_image column stores a bare filename (not a full URL) — resolved to a `/files/...`
// URL here, at read time, so the stored value stays independent of the file-serving route shape.
export function workshopPhotoUrl(filename: string): string {
  return `/files/workshops/photos/${encodeURIComponent(filename)}`;
}

// "Latest wins" convention: a workshop may have an org-uploaded "official" report and/or
// participant-guide document — one active file per kind per workshop, the lexicographically
// last (i.e. most-recent-timestamp-named, "<workshop_id>_<epoch-ms>.<ext>") file wins.
export function findLatestWorkshopDocument(kind: WorkshopDocKind, workshopId: string): { filename: string; url: string } | null {
  const prefix = `${workshopId}_`;
  const latest = listDirSafe(workshopDocsDir(kind))
    .filter((f) => f.startsWith(prefix))
    .sort()
    .at(-1);
  if (!latest) return null;
  return { filename: latest, url: `/files/workshops/${kind}/${encodeURIComponent(latest)}` };
}

export function removeExistingWorkshopDocuments(kind: WorkshopDocKind, workshopId: string): void {
  const dir = workshopDocsDir(kind);
  const prefix = `${workshopId}_`;
  for (const entry of listDirSafe(dir)) {
    if (entry.startsWith(prefix)) fs.unlinkSync(path.join(dir, entry));
  }
}
