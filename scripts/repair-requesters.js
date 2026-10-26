'use strict';
require('dotenv').config();
const pg = require('pg');
const { poolConfig } = require('../lib/db');

(async () => {
  const pool = new pg.Pool(poolConfig());
  try {
    const users = await pool.query(`
      SELECT id, full_name, position
      FROM users
      WHERE is_active
      ORDER BY id`);
    console.log('Active users:', users.rows);
    const before = await pool.query(`
      SELECT id, request_no, requester_id, requester_name, position, department_id
      FROM requests
      ORDER BY id DESC
      LIMIT 20`);
    console.log('Requests found:', before.rowCount, before.rows);

    const result = await pool.query(`
      UPDATE requests r
         SET requester_id = u.id,
             position = d.name,
             updated_at = NOW()
        FROM users u, departments d
       WHERE u.is_active
         AND d.id = r.department_id
         AND lower(regexp_replace(trim(u.full_name), '^(mr\\.|ms\\.|mrs\\.|miss)\\s*', '')) =
             lower(regexp_replace(trim(r.requester_name), '^(mr\\.|ms\\.|mrs\\.|miss)\\s*', ''))`);
    console.log(`Repaired ${result.rowCount} request(s).`);
    const legacy = await pool.query(`
      UPDATE requests
         SET position = (SELECT name FROM departments WHERE id = requests.department_id),
             updated_at = NOW()
       WHERE lower(trim(position)) = 'hr/admin officer'`);
    console.log(`Repaired ${legacy.rowCount} legacy admin-position request(s).`);
  } finally {
    await pool.end();
  }
})().catch((err) => { console.error(err); process.exitCode = 1; });
