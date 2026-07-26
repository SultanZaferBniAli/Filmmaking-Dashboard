import { entities } from '../src/entities/index.js';
import { findActiveRows } from '../src/store.js';
import { DATA_DIR } from '../src/config.js';

async function main() {
  console.log(`DATA_DIR: ${DATA_DIR}\n`);
  for (const entity of Object.values(entities)) {
    const rows = await findActiveRows(entity, true);
    const active = rows.filter((r) => !r.deleted_at);
    console.log(`${entity.name}: ${active.length} active row(s) (${rows.length - active.length} soft-deleted)`);
  }

  const participants = await findActiveRows(entities.participants);
  const byStatus = new Map<string, number>();
  for (const p of participants) {
    const key = String(p.status);
    byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
  }
  console.log('\nparticipants by status:', Object.fromEntries(byStatus));

  const feedback = await findActiveRows(entities.feedback);
  const ratings = feedback.map((f) => Number(f.overall_rating)).filter((n) => n >= 1 && n <= 5);
  const average = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  console.log(`feedback: ${feedback.length} response(s), average overall_rating ${average.toFixed(2)}/5`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
