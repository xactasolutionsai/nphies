// Read-only reference catalogue inventory; no patient information selected.
import pg from '/opt/nafes/current/backend/node_modules/pg/lib/index.js';
const client=new pg.Client({host:process.env.DB_HOST||'localhost',port:process.env.DB_PORT||5432,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
await client.connect();await client.query('BEGIN READ ONLY');
try {
 const report={};
 report.tables=(await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name ~* '(code|drg|termin|sbs|procedure)' ORDER BY table_name")).rows;
 report.systems=(await client.query('SELECT s.code,s.name,s.source_url,s.is_active,count(c.*)::int AS entries FROM nphies_code_systems s LEFT JOIN nphies_codes c USING(code_system_id) GROUP BY s.code_system_id ORDER BY s.code')).rows;
 report.drgLikeCodes=(await client.query("SELECT s.code AS system,c.code,c.display_en,c.is_active FROM nphies_codes c JOIN nphies_code_systems s USING(code_system_id) WHERE s.code ~* '(drg|diagnosis-related)' OR c.code IN ('E62B','960Z','961Z','963Z') LIMIT 25")).rows;
 report.columns=(await client.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name ~* '(code|drg|termin|sbs|procedure)' ORDER BY table_name,ordinal_position")).rows;
 for(const {table_name} of report.tables){if(/^[a-z_0-9]+$/.test(table_name)) {const r=await client.query(`SELECT count(*)::int AS count FROM "${table_name}"`); report.tableCounts??={};report.tableCounts[table_name]=r.rows[0].count;}}
 console.log(JSON.stringify(report,null,2));
} finally {await client.query('ROLLBACK');await client.end();}
