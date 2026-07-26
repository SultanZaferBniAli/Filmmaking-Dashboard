import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToApiError } from '../errors.js';
import { buildWorkshopXlsx, type WorkshopExportPayload } from '../report/buildWorkshopXlsx.js';
import { buildAllWorkshopsXlsx, type AllWorkshopsExportPayload } from '../report/buildAllWorkshopsXlsx.js';

const genderCountSchema = z.object({ male: z.number(), female: z.number() });

const participantSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  department: z.string(),
  attended: z.number(),
  missed: z.number(),
  eligible: z.boolean(),
});

const statsSchema = z.object({
  registrations: genderCountSchema,
  accepted: genderCountSchema,
  attendance: genderCountSchema,
  actualAttendance: genderCountSchema,
  ratingCounts: z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()]),
});

const bodySchema = z.object({
  workshopName: z.string(),
  infoRows: z.array(z.object({ label: z.string(), value: z.union([z.string(), z.number()]) })),
  stats: statsSchema,
  participants: z.array(participantSchema),
  sessionCount: z.number(),
  attendanceRows: z.array(z.object({ name: z.string(), sessions: z.array(z.boolean()) })),
}) satisfies z.ZodType<WorkshopExportPayload>;

const allBodySchema = z.object({
  workshops: z
    .array(
      z.object({
        workshopName: z.string(),
        infoRows: z.array(z.object({ label: z.string(), value: z.union([z.string(), z.number()]) })),
        stats: statsSchema,
        participants: z.array(participantSchema),
      }),
    )
    .min(1),
}) satisfies z.ZodType<AllWorkshopsExportPayload>;

export function registerWorkshopExportRoutes(app: FastifyInstance) {
  app.post('/export/workshop-xlsx', async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) throw zodToApiError(parsed.error);

    const buffer = await buildWorkshopXlsx(parsed.data);

    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(parsed.data.workshopName)}.xlsx"`);
    reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return buffer;
  });

  app.post('/export/workshops-xlsx', async (req, reply) => {
    const parsed = allBodySchema.safeParse(req.body);
    if (!parsed.success) throw zodToApiError(parsed.error);

    const buffer = await buildAllWorkshopsXlsx(parsed.data);

    const today = new Date().toISOString().slice(0, 10);
    reply.header('Content-Disposition', `attachment; filename="workshops-export-${today}.xlsx"`);
    reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return buffer;
  });
}
