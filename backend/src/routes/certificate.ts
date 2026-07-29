import type { FastifyInstance } from 'fastify';
import { workshopEntity } from '../entities/index.js';
import { findRowById } from '../store.js';
import { ApiError } from '../errors.js';
import { generateCertificateContent, listEligibleParticipantIds } from '../report/certificateContent.js';
import { buildCertificatePptx } from '../report/buildCertificatePptx.js';
import { createZipBuffer } from '../zip.js';

export function registerCertificateRoutes(app: FastifyInstance) {
  app.get('/workshops/:id/participants/:participantId/certificate.pptx', async (req, reply) => {
    const { id, participantId } = req.params as { id: string; participantId: string };

    const content = await generateCertificateContent(id, participantId);
    const buffer = await buildCertificatePptx(content);

    reply.header('Content-Disposition', `attachment; filename="${participantId}-certificate.pptx"`);
    reply.type('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    return buffer;
  });

  // Bundles every eligible (>=80% attendance) participant's certificate into one zip — an
  // individual participant's build failure (e.g. missing gender) is skipped rather than failing
  // the whole batch, since the other, valid certificates should still download.
  app.get('/workshops/:id/certificates.zip', async (req, reply) => {
    const { id } = req.params as { id: string };
    const workshop = await findRowById(workshopEntity, id);
    if (!workshop) throw new ApiError(404, 'NOT_FOUND', `workshops/${id} not found`);

    const eligibleIds = await listEligibleParticipantIds(id);
    if (eligibleIds.length === 0) throw new ApiError(404, 'NOT_FOUND', `No certificate-eligible participants found for workshops/${id}`);

    const entries: { name: string; content: Buffer }[] = [];
    for (const participantId of eligibleIds) {
      try {
        const content = await generateCertificateContent(id, participantId);
        const buffer = await buildCertificatePptx(content);
        entries.push({ name: `${content.participantName}.pptx`, content: buffer });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[certificate] skipping participant ${participantId} in workshops/${id}/certificates.zip:`, err instanceof Error ? err.message : err);
      }
    }
    if (entries.length === 0) throw new ApiError(422, 'BUILD_FAILED', `None of workshops/${id}'s eligible participants could be built into a certificate`);

    const zipBuffer = createZipBuffer(entries);
    reply.header('Content-Disposition', `attachment; filename="${id}-certificates.zip"`);
    reply.type('application/zip');
    return zipBuffer;
  });
}
