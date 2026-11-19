import fs from 'fs';
import { config } from '../config.js';

if (fs.existsSync(config.databasePath)) {
  fs.unlinkSync(config.databasePath);
  // also remove WAL/SHM if present
  for (const ext of ['-wal', '-shm']) {
    const p = config.databasePath + ext;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  console.log('Database deleted.');
} else {
  console.log('No database found.');
}

console.log('Run `npm run db:migrate` to recreate.');
process.exit(0);
