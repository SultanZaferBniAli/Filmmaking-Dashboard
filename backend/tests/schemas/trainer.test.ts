import { describe, it, expect } from 'vitest';
import { trainerEntity } from '../../src/entities/trainer.js';

function validRawRow() {
  return {
    trainer_id: 'TR-001',
    name_ar: 'أحمد حافظ',
    name_en: 'Ahmed Hafez',
    nationality: 'مصري',
    nationality_code: 'EG',
    field: 'محرر أفلام',
    years_experience: 'أكثر من 25 عامًا',
    professional_membership: 'ACE',
    accounts: 'IMDb',
    bio: 'bio text',
    notable_works: 'work',
    festival_recognition: 'fest',
    award: 'award',
    contact: '+966553958799',
  };
}

function parse(raw: Record<string, unknown>) {
  const { row } = trainerEntity.mapRow(raw);
  return trainerEntity.schema.safeParse(row);
}

describe('trainer schema', () => {
  it('accepts a valid row', () => {
    expect(parse(validRawRow()).success).toBe(true);
  });

  it('rejects a malformed trainer_id', () => {
    expect(parse({ ...validRawRow(), trainer_id: 'TRAINER-1' }).success).toBe(false);
  });

  it('rejects a nationality_code that is not 2 letters', () => {
    expect(parse({ ...validRawRow(), nationality_code: 'EGY' }).success).toBe(false);
  });

  it('rejects a blank name_ar', () => {
    expect(parse({ ...validRawRow(), name_ar: '   ' }).success).toBe(false);
  });

  it('lowercase nationality_code input is normalized to uppercase', () => {
    const { row } = trainerEntity.mapRow({ ...validRawRow(), nationality_code: 'eg' });
    expect(row.nationality_code).toBe('EG');
  });
});
