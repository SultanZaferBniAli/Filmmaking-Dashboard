import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToApiError } from '../errors.js';
import { buildParticipantsXlsx, type ParticipantExportRow } from '../report/buildParticipantsXlsx.js';

const rowSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  gender: z.string(),
  jobTitle: z.string(),
  experienceLevel: z.string(),
  experienceYears: z.union([z.string(), z.number()]),
  applicationStatus: z.string(),
  acceptanceStatus: z.string(),
  attendanceStatus: z.string(),
  actualAttendance: z.string(),
  workshopName: z.string(),
  workshopType: z.string(),
  workshopField: z.string(),
  region: z.string(),
  city: z.string(),
  workshopDate: z.string(),
  registeredCount: z.number(),
  attendedCount: z.number(),
  completedCount: z.number(),
  certificateAvailable: z.string(),
}) satisfies z.ZodType<ParticipantExportRow>;

const bodySchema = z.object({ rows: z.array(rowSchema) });

export function registerParticipantsExportRoutes(app: FastifyInstance) {
  app.post('/export/participants-xlsx', async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) throw zodToApiError(parsed.error);

    const buffer = await buildParticipantsXlsx(parsed.data.rows);
    const today = new Date().toISOString().slice(0, 10);

    reply.header('Content-Disposition', `attachment; filename="participants-season-5-${today}.xlsx"`);
    reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return buffer;
  });
}
