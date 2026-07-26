import { describe, it, expect } from 'vitest';
import { participantEntity } from '../../src/entities/participant.js';

function validRawRow() {
  return {
    participant_id: 'P-003-011',
    workshop_id: 'WS-003',
    full_name_arabic: 'فيصل وسام السليماني',
    full_name_en: null,
    gender: 'male',
    nationality: 'سعودي',
    national_id: '1115584052',
    phone: '+966557797771',
    email: 'Faisal@Example.com',
    city: 'الظهران',
    region_code: 'eastern',
    date_of_birth: '2002-03-29',
    education_level: 'تعليم عالي',
    skill_level: 'advanced',
    experience_level: 'سنتين وأقل',
    track: 'التصوير السينمائي',
    current_role: 'مخرج',
    has_editing_exp: 'نعم',
    editing_software: 'Premiere',
    how_heard: 'البريد',
    application_date: '2024-08-08',
    portfolio_url: 'https://example.com/reel.mp4',
    evaluation_score: 100,
    status: 'accepted',
    day_1: '',
    day_2: '',
    day_3: '',
    day_4: '',
    day_5: '',
    sessions_attended: '',
    total_sessions: 5,
  };
}

function parse(raw: Record<string, unknown>) {
  const { row } = participantEntity.mapRow(raw);
  return participantEntity.schema.safeParse(row);
}

describe('participant schema', () => {
  it('accepts a valid row and lowercases the email', () => {
    const { row } = participantEntity.mapRow(validRawRow());
    expect(row.email).toBe('faisal@example.com');
    expect(participantEntity.schema.safeParse(row).success).toBe(true);
  });

  it('maps the three known Arabic experience_level labels exhaustively', () => {
    expect(participantEntity.mapRow({ ...validRawRow(), experience_level: 'بدون خبرة' }).row.experience_level).toBe('none');
    expect(participantEntity.mapRow({ ...validRawRow(), experience_level: 'سنتين وأقل' }).row.experience_level).toBe('1_to_2');
    expect(participantEntity.mapRow({ ...validRawRow(), experience_level: '3 سنوات فأكثر' }).row.experience_level).toBe('3_to_5');
  });

  it('rejects an invalid email', () => {
    expect(parse({ ...validRawRow(), email: 'not-an-email' }).success).toBe(false);
  });

  it('accepts evaluation_score boundaries 0 and 100, rejects -1 and 101', () => {
    expect(parse({ ...validRawRow(), evaluation_score: 0 }).success).toBe(true);
    expect(parse({ ...validRawRow(), evaluation_score: 100 }).success).toBe(true);
    expect(parse({ ...validRawRow(), evaluation_score: -1 }).success).toBe(false);
    expect(parse({ ...validRawRow(), evaluation_score: 101 }).success).toBe(false);
  });

  it('allows a blank evaluation_score (not yet screened)', () => {
    expect(parse({ ...validRawRow(), evaluation_score: '' }).success).toBe(true);
  });

  it('flags (does not reject) a national_id that is not 10 digits', () => {
    const { row } = participantEntity.mapRow({ ...validRawRow(), national_id: '12345' });
    expect(row.national_id).toBe('12345');
    expect(row.national_id_valid).toBe(false);
    expect(participantEntity.schema.safeParse(row).success).toBe(true);
  });

  it('detects the corrupted-phone pattern (numeric truncation) and keeps the value as-is', () => {
    const { row, warnings } = participantEntity.mapRow({ ...validRawRow(), phone: '9660540000000' });
    expect(row.phone).toBe('9660540000000');
    expect(row.phone_verified).toBe(false);
    expect(warnings.some((w) => w.includes('corrupted'))).toBe(true);
  });

  it('preserves an already ~-flagged phone unchanged', () => {
    const { row } = participantEntity.mapRow({ ...validRawRow(), phone: '~966538000000' });
    expect(row.phone).toBe('~966538000000');
    expect(row.phone_verified).toBe(false);
  });

  it('leaves region blank with a warning for an unmappable multi-city value', () => {
    const { row, warnings } = participantEntity.mapRow({ ...validRawRow(), city: 'mecca+khobar', region_code: '' });
    expect(row.region_code).toBeNull();
    expect(row.city).toBe('mecca+khobar');
    expect(warnings.some((w) => w.includes('mecca+khobar'))).toBe(true);
  });

  it('rejects sessions_attended greater than total_sessions', () => {
    const result = parse({ ...validRawRow(), sessions_attended: 6, total_sessions: 5 });
    expect(result.success).toBe(false);
  });

  it('computes attendance_percentage/status server-side from sessions_attended', () => {
    const { row } = participantEntity.mapRow({ ...validRawRow(), sessions_attended: 4, total_sessions: 5 });
    expect(row.attendance_percentage).toBe(80);
    expect(row.attendance_status).toBe('حضور فعلي');
  });

  it('is idempotent — re-mapping an already-normalized row does not change it', () => {
    const first = participantEntity.mapRow(validRawRow()).row;
    const second = participantEntity.mapRow(first).row;
    expect(second).toEqual(first);
  });
});
