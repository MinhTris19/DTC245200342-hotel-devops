const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  const adminHash = await bcrypt.hash('Admin@Hotel2026!', 10);
  const staffHash = await bcrypt.hash('Staff@Hotel2026!', 10);
  const custHash = await bcrypt.hash('Customer@Hotel2026!', 10);

  console.log('Generated hashes:');
  console.log('Admin:', adminHash);
  console.log('Staff:', staffHash);
  console.log('Cust:', custHash);

  await pool.query("UPDATE users SET password_hash = $1 WHERE username = 'admin'", [adminHash]);
  await pool.query("UPDATE users SET password_hash = $1 WHERE username IN ('letan01', 'letan02')", [staffHash]);
  await pool.query("UPDATE users SET password_hash = $1 WHERE username IN ('khach01', 'khach02')", [custHash]);

  console.log('Successfully updated seed user password hashes in PostgreSQL!');
  await pool.end();
}

main().catch(err => {
  console.error('Error updating passwords:', err);
  process.exit(1);
});
