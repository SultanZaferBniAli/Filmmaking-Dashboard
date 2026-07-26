import type { Trainer } from '../data/trainers';
import { nationalityByCode } from '../data/trainers';
import type { WorkshopField, WorkshopType } from '../data/workshops';

export type TrainerFilters = {
  workshopTypes: WorkshopType[];
  fields: WorkshopField[];
  nationalityCodes: string[];
};

export const defaultTrainerFilters: TrainerFilters = {
  workshopTypes: [],
  fields: [],
  nationalityCodes: [],
};

export function filterTrainers(trainers: Trainer[], filters: TrainerFilters): Trainer[] {
  return trainers.filter((t) => {
    if (filters.workshopTypes.length > 0 && !t.workshops.some((w) => filters.workshopTypes.includes(w.workshopType))) {
      return false;
    }
    if (filters.fields.length > 0 && !t.workshops.some((w) => filters.fields.includes(w.field))) {
      return false;
    }
    if (filters.nationalityCodes.length > 0 && !filters.nationalityCodes.includes(t.nationalityCode)) {
      return false;
    }
    return true;
  });
}

export interface TrainerKpis {
  total: number;
  international: number;
  localAndRegional: number;
  agencies: number;
}

export function computeTrainerKpis(trainers: Trainer[]): TrainerKpis {
  let international = 0;
  let localAndRegional = 0;
  const agencySet = new Set<string>();
  for (const t of trainers) {
    if (t.category === 'international') international++;
    else localAndRegional++;
    if (t.company) agencySet.add(t.company);
  }
  return { total: trainers.length, international, localAndRegional, agencies: agencySet.size };
}

export function nationalityOptions(trainers: Trainer[]): { code: string; label: string }[] {
  const codes = new Set<string>();
  for (const t of trainers) codes.add(t.nationalityCode);
  return Array.from(codes)
    .map((code) => ({ code, label: nationalityByCode[code]?.nameAr ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ar'));
}

export function trainerNameOptions(trainers: Trainer[]): string[] {
  return Array.from(new Set(trainers.map((t) => t.fullName))).sort((a, b) => a.localeCompare(b, 'ar'));
}

export function matchesTrainerSearch(trainer: Trainer, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return trainer.fullName.toLowerCase().includes(query);
}
