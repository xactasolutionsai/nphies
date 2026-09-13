// Reuse the privately generated deployment credential without modifying imported accounts.
import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from '../backend/node_modules/bcryptjs/index.js';
import pool from '../backend/db.js';
const file='/etc/nafes/admin-bootstrap.json';
try {
  const credentials=JSON.parse(fs.readFileSync(file,'utf8'));
  const existing=await pool.query('SELECT id FROM users WHERE email=$1',[credentials.email]);
  if(existing.rowCount) credentials.email=`deployment-${crypto.randomBytes(4).toString('hex')}@nafes.local`;
  await pool.query("INSERT INTO users(email,password_hash,role) VALUES($1,$2,'admin')",
    [credentials.email,await bcrypt.hash(credentials.password,12)]);
  fs.writeFileSync(file,JSON.stringify(credentials,null,2),{mode:0o600});
  console.log('Deployment administrator added without changing imported account passwords');
} finally {await pool.end();}
