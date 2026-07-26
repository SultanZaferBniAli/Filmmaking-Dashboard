import { describe, it, expect } from 'vitest';
import { workshopEntity } from '../../src/entities/workshop.js';

function validRawRow() {
  return {
    workshop_id: 'WS-003',
    workshop_name: 'تقنيات مونتاج الأفلام',
    workshop_type: 'in-person',
    field: 'تحرير الأفلام',
    year: '2024',
    region_code: 'eastern',
    region_name: 'المنطقة الشرقية',
    city: 'الخبر',
    location_type: 'in-person',
    location_name: 'جمعية السينما',
    location_link: 'https://maps.example.com',
    start_date: '2024-08-18',
    end_date: '2024-08-22',
    start_time: '16:00',
    end_time: '20:00',
    language: 'العربية',
    level: '',
    capacity: '',
    trainer_id: 'TR-001',
    status: 'upcoming',
  };
}

function parse(raw: Record<string, unknown>) {
  const { row } = workshopEntity.mapRow(raw);
  return workshopEntity.schema.safeParse(row);
}

describe('workshop schema', () => {
  it('accepts a valid row (blank level/capacity default correctly downstream)', () => {
    const result = parse(validRawRow());
    expect(result.success).toBe(true);
  });

  it('rejects a malformed workshop_id', () => {
    const result = parse({ ...validRawRow(), workshop_id: 'WORKSHOP-3' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown region code', () => {
    const result = parse({ ...validRawRow(), region_code: 'nowhere' });
    expect(result.success).toBe(false);
  });

  it('rejects end_date before start_date', () => {
    const result = parse({ ...validRawRow(), start_date: '2024-08-22', end_date: '2024-08-18' });
    expect(result.success).toBe(false);
  });

  it('accepts every real WorkshopType value (not just the 2-value location_type set)', () => {
    for (const type of ['in-person', 'virtual', 'masterclass', 'specialized', 'residency']) {
      const result = parse({ ...validRawRow(), workshop_type: type });
      expect(result.success, `workshop_type=${type} should be valid`).toBe(true);
    }
  });

  it('rejects an invalid status value (boundary/enum check)', () => {
    const result = parse({ ...validRawRow(), status: 'ongoing' });
    expect(result.success).toBe(false);
  });

  it('is idempotent — re-mapping an already-normalized row does not change it', () => {
    const first = workshopEntity.mapRow(validRawRow()).row;
    const second = workshopEntity.mapRow(first).row;
    expect(second).toEqual(first);
  });
});
