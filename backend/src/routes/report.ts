import type { FastifyInstance } from 'fastify';
import { workshopEntity } from '../entities/index.js';
import { findRowById } from '../store.js';
import { ApiError } from '../errors.js';
import { generateReportContent, type OutputLanguage } from '../report/reportContent.js';
import { buildReportPptx } from '../report/buildReportPptx.js';

export function registerReportRoutes(app: FastifyInstance) {
  app.get('/workshops/:id/report.pptx', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { lang } = req.query as { lang?: string };
    const outputLanguage: OutputLanguage = lang === 'en' ? 'en' : 'ar';

    const workshop = await findRowById(workshopEntity, id);
    if (!workshop) throw new ApiError(404, 'NOT_FOUND', `workshops/${id} not found`);

    const content = await generateReportContent(id, outputLanguage);
    const buffer = await buildReportPptx(content);

    reply.header('Content-Disposition', `attachment; filename="${id}-report.pptx"`);
    reply.type('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    return buffer;
  });
}
