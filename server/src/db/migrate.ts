import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from './index.js';
import { SCHEMA_SQL } from './schema.js';
import { config } from '../config.js';

console.log('Running database migration...');

db.exec(SCHEMA_SQL);

// Ensure admin user exists
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(config.adminUsername);

if (!existing) {
  const id = uuidv4();
  const hash = bcrypt.hashSync(config.adminPassword, 12);
  db.prepare(
    `INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)`
  ).run(id, config.adminUsername, hash);
  console.log(`✓ Created admin user: ${config.adminUsername}`);
} else {
  console.log(`✓ Admin user already exists: ${config.adminUsername}`);
}

console.log('✓ Migration complete');
process.exit(0);
