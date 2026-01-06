import bcrypt from 'bcryptjs';

async function generateHash() {
  const password = '123123';
  const saltRounds = 10;
  const hash = await bcrypt.hash(password, saltRounds);
  
  console.log('Password: 123123');
  console.log('Bcrypt Hash:', hash);
  console.log('\nSQL Query:');
  console.log(`INSERT INTO users (email, password_hash) 
VALUES (
  'eng.anasshamia@gmail.com',
  '${hash}'
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash;`);
}

generateHash().catch(console.error);

