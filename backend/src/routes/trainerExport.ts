import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToApiError } from '../errors.js';
import { buildTrainerXlsx, type TrainerExportPayload } from '../report/buildTrainerXlsx.js';

const valueSchema = z.union([z.string(), z.number()]);

const bodySchema = z.object({
  trainerName: z.string(),
  infoRows: z.array(z.object({ label: z.string(), value: valueSchema })),
  workshops: z.array(
    z.object({ name: z.string(), type: z.string(), field: z.string(), year: valueSchema, city: z.string(), region: z.string() }),
  ),
  projects: z.array(z.object({ title: z.string(), year: valueSchema, role: z.string(), type: z.string() })),
  awards: z.array(z.object({ title: z.string(), year: valueSchema })),
}) satisfies z.ZodType<TrainerExportPayload>;

export function registerTrainerExportRoutes(app: FastifyInstance) {
  app.post('/export/trainer-xlsx', async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) throw zodToApiError(parsed.error);

    const buffer = await buildTrainerXlsx(parsed.data);

    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(parsed.data.trainerName)}.xlsx"`);
    reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return buffer;
  });
}
