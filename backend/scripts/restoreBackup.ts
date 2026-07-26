import { entities } from '../src/entities/index.js';
import { restoreFromBackup, listBackups } from '../src/store.js';

function usage(): never {
  console.error('Usage: npm run restore -- <entity> <backup-filename>');
  console.error('       npm run restore -- <entity>              (list available backups)');
  console.error(`Known entities: ${Object.keys(entities).join(', ')}`);
  process.exit(1);
}

async function main() {
  const [, , entityName, backupFileName] = process.argv;
  const entity = entityName ? entities[entityName] : undefined;
  if (!entity) usage();

  if (!backupFileName) {
    const available = await listBackups(entity);
    console.log(`Available backups for "${entity.name}":`);
    available.forEach((f) => console.log(`  ${f}`));
    if (available.length === 0) console.log('  (none)');
    process.exit(0);
  }

  await restoreFromBackup(entity, backupFileName);
  console.log(`Restored "${entity.name}" from backup "${backupFileName}" (the pre-restore state was itself backed up first).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
