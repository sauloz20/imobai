import postgres from "postgres";
import crypto from "node:crypto";

const sql = postgres(process.env.DATABASE_URL!);
const token = crypto.randomUUID().replace(/-/g, "").repeat(2);

try {
  console.log(
    await sql`
      INSERT INTO local_sessions (token_hash, user_id, expires_at)
      VALUES (${token}, 19, NOW() + INTERVAL '30 days')
      RETURNING id, user_id
    `
  );
} catch (e) {
  console.error(e);
} finally {
  await sql.end();
}
