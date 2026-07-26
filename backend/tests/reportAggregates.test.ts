import { describe, it, expect } from 'vitest';
import type { Row } from '../src/entities/index.js';
import { computeAgeBuckets, computeTrackBreakdown, computeOverallRating } from '../src/serialize/reportAggregates.js';

const asOf = new Date('2026-07-14T00:00:00Z');

function participant(overrides: Partial<Row> = {}): Row {
  return {
    participant_id: 'P-001',
    workshop_id: 'WS-001',
    track: 'كتابة السيناريو',
    date_of_birth: '2000-01-01',
    ...overrides,
  };
}

function feedback(overrides: Partial<Row> = {}): Row {
  return {
    feedback_id: 'FB-001',
    workshop_id: 'WS-001',
    overall_rating: 5,
    trainer_quality: 5,
    content_quality: 5,
    ...overrides,
  };
}

describe('computeAgeBuckets', () => {
  it('buckets 18-24, 25-30, and 30+ correctly, and respects the exact boundaries', () => {
    const rows = [
      participant({ date_of_birth: '2008-01-01' }), // exactly 18 on 2026-01-01, so 18 as of the asOf date
      participant({ date_of_birth: '2001-08-01' }), // 24 (birthday not yet reached this year)
      participant({ date_of_birth: '2001-01-01' }), // 25
      participant({ date_of_birth: '1996-01-01' }), // 30
      participant({ date_of_birth: '1990-01-01' }), // 36
    ];
    const buckets = computeAgeBuckets(rows, asOf);
    expect(buckets).toEqual({ age_18_24_count: 2, age_25_30_count: 2, age_30_plus_count: 1 });
  });

  it('excludes participants with missing or invalid date_of_birth rather than guessing', () => {
    const rows = [participant({ date_of_birth: null }), participant({ date_of_birth: 'not-a-date' })];
    expect(computeAgeBuckets(rows, asOf)).toEqual({ age_18_24_count: 0, age_25_30_count: 0, age_30_plus_count: 0 });
  });

  it('returns all zeros for an empty list', () => {
    expect(computeAgeBuckets([], asOf)).toEqual({ age_18_24_count: 0, age_25_30_count: 0, age_30_plus_count: 0 });
  });
});

describe('computeTrackBreakdown', () => {
  it('counts accepted participants by track, sorted descending', () => {
    const rows = [
      participant({ track: 'مونتاج' }),
      participant({ track: 'مونتاج' }),
      participant({ track: 'كتابة السيناريو' }),
    ];
    expect(computeTrackBreakdown(rows)).toEqual([
      { label: 'مونتاج', count: 2 },
      { label: 'كتابة السيناريو', count: 1 },
    ]);
  });

  it('ignores rows with a missing or blank track', () => {
    const rows = [participant({ track: null }), participant({ track: '  ' })];
    expect(computeTrackBreakdown(rows)).toEqual([]);
  });
});

describe('computeOverallRating', () => {
  it('averages overall_rating (the "ما مستوى رضاك العام عن الورشة؟" question) into a percent and label', () => {
    const rows = [feedback({ overall_rating: 5 }), feedback({ overall_rating: 5 })]; // avg 5/5 -> 100%
    expect(computeOverallRating(rows)).toEqual({ overall_rating_percent: 100, overall_rating_label: 'ممتاز' });
  });

  it('bands the label by percent: excellent/good/fair/needs improvement', () => {
    expect(computeOverallRating([feedback({ overall_rating: 3 })])).toEqual({ overall_rating_percent: 60, overall_rating_label: 'جيد' });
    expect(computeOverallRating([feedback({ overall_rating: 2 })])).toEqual({ overall_rating_percent: 40, overall_rating_label: 'مقبول' });
    expect(computeOverallRating([feedback({ overall_rating: 1 })])).toEqual({ overall_rating_percent: 20, overall_rating_label: 'يحتاج تحسين' });
  });

  it('ignores rows with a missing or out-of-range overall_rating', () => {
    const rows = [feedback({ overall_rating: null }), feedback({ overall_rating: 0 }), feedback({ overall_rating: 6 })];
    expect(computeOverallRating(rows)).toEqual({ overall_rating_percent: 0, overall_rating_label: 'لا يوجد' });
  });

  it('guards division by zero when there is no feedback at all', () => {
    expect(computeOverallRating([])).toEqual({ overall_rating_percent: 0, overall_rating_label: 'لا يوجد' });
  });
});
