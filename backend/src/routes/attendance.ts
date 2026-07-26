import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { workshopEntity, participantEntity, type Row } from '../entities/index.js';
import { readRows, writeRows, findRowById } from '../store.js';
import { appendAuditEntry, diffFields, type ChangedFieldDiff } from '../audit.js';
import { ApiError, zodToApiError } from '../errors.js';
import { serializeWorkshop } from '../serialize/workshop.js';

const dayField = z.boolean().nullable().optional();
const attendanceEntrySchema = z.object({
  participant_id: z.string(),
  day_1: dayField,
  day_2: dayField,
  day_3: dayField,
  day_4: dayField,
  day_5: dayField,
});
const attendancePayloadSchema = z.object({
  participantAttendance: z.array(attendanceEntrySchema),
});

// Batch save for the Workshop Detail "الحضور" tab: accepts every changed participant's day
// grid in one call, recomputes sessions_attended/attendance_percentage/attendance_status
// server-side (never trusts client-computed aggregates), writes them in a single atomic
// operation, and logs one audit entry per participant that actually changed.
export function registerAttendanceRoute(app: FastifyInstance) {
  app.patch('/workshops/:id/attendance', async (req) => {
    const { id } = req.params as { id: string };
    const workshop = await findRowById(workshopEntity, id);
    if (!workshop) throw new ApiError(404, 'NOT_FOUND', `workshops/${id} not found`);

    const parsed = attendancePayloadSchema.safeParse(req.body);
    if (!parsed.success) throw zodToApiError(parsed.error);

    const rows = await readRows(participantEntity);
    const updatedRows = [...rows];
    const auditOps: { participantId: string; changed: Record<string, ChangedFieldDiff> }[] = [];

    for (const entry of parsed.data.participantAttendance) {
      const idx = updatedRows.findIndex((r) => String(r.participant_id) === entry.participant_id && String(r.workshop_id) === id && !r.deleted_at);
      if (idx === -1) {
        throw new ApiError(400, 'BAD_REFERENCE', `participant_id "${entry.participant_id}" is not an active participant of workshops/${id}`);
      }

      const existing = updatedRows[idx];
      const merged: Row = {
        ...existing,
        day_1: entry.day_1 ?? existing.day_1,
        day_2: entry.day_2 ?? existing.day_2,
        day_3: entry.day_3 ?? existing.day_3,
        day_4: entry.day_4 ?? existing.day_4,
        day_5: entry.day_5 ?? existing.day_5,
      };

      const totalSessions = Number(existing.total_sessions ?? 5) || 5;
      const sessionsAttended = [merged.day_1, merged.day_2, merged.day_3, merged.day_4, merged.day_5]
        .slice(0, totalSessions)
        .filter(Boolean).length;
      merged.sessions_attended = sessionsAttended;
      merged.total_sessions = totalSessions;

      const { row: mapped } = participantEntity.mapRow(merged);
      const parsedRow = participantEntity.schema.safeParse(mapped);
      if (!parsedRow.success) throw zodToApiError(parsedRow.error);

      const candidate = { ...(parsedRow.data as Row), deleted_at: existing.deleted_at ?? null };
      const changed = diffFields(existing, candidate);
      if (Object.keys(changed).length > 0) {
        updatedRows[idx] = candidate;
        auditOps.push({ participantId: entry.participant_id, changed });
      }
    }

    if (auditOps.length > 0) {
      await writeRows(participantEntity, updatedRows);
      for (const op of auditOps) {
        appendAuditEntry({
          entity: 'participants',
          record_id: op.participantId,
          action: 'update',
          changed_fields: op.changed,
          source: 'dashboard-edit',
          source_detail: 'attendance-tab',
          actor: null,
        });
      }
    }

    const refreshedWorkshop = await findRowById(workshopEntity, id);
    return serializeWorkshop(refreshedWorkshop as Row);
  });
}
