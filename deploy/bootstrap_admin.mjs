// Run as root from the deployed backend. Writes initial credentials only to a root-only file.
import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from '../backend/node_modules/bcryptjs/index.js';
import pool from '../backend/db.js';
const file = '/etc/nafes/admin-bootstrap.json';
try {
  if (fs.existsSync(file)) throw new Error('Bootstrap credential file already exists; refusing to reset the administrator');
  const email = 'admin@nafes.local';
  const password = crypto.randomBytes(24).toString('base64url');
  const hash = await bcrypt.hash(password, 12);
  await pool.query("INSERT INTO users(email,password_hash,role) VALUES($1,$2,'admin')", [email,hash]);
  fs.writeFileSync(file, JSON.stringify({url:'https://87.237.225.69',email,password}, null,2), {mode:0o600});
  console.log('Administrator created; credentials stored in /etc/nafes/admin-bootstrap.json');
} finally { await pool.end(); }
