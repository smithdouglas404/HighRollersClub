import { db, pool } from "@workspace/db";
import { transactionsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

export async function getBalance(userId: number): Promise<number> {
  const [latest] = await db
    .select({ balanceAfter: transactionsTable.balanceAfter })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(desc(transactionsTable.id))
    .limit(1);

  return latest?.balanceAfter ?? 0;
}

export async function creditChips(
  userId: number,
  amount: number,
  type: string,
  description: string,
  referenceType?: string,
  referenceId?: number,
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT 1 FROM transactions WHERE user_id = $1 FOR UPDATE", [userId]);

    const balRes = await client.query(
      "SELECT balance_after FROM transactions WHERE user_id = $1 ORDER BY id DESC LIMIT 1",
      [userId]
    );
    const currentBalance = balRes.rows.length > 0 ? Number(balRes.rows[0].balance_after) : 0;
    const newBalance = currentBalance + amount;

    await client.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, reference_type, reference_id, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, type, amount, newBalance, referenceType ?? null, referenceId ?? null, description]
    );

    await client.query("COMMIT");
    return newBalance;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function debitChips(
  userId: number,
  amount: number,
  type: string,
  description: string,
  referenceType?: string,
  referenceId?: number,
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT 1 FROM transactions WHERE user_id = $1 FOR UPDATE", [userId]);

    const balRes = await client.query(
      "SELECT balance_after FROM transactions WHERE user_id = $1 ORDER BY id DESC LIMIT 1",
      [userId]
    );
    const currentBalance = balRes.rows.length > 0 ? Number(balRes.rows[0].balance_after) : 0;

    if (currentBalance < amount) {
      await client.query("ROLLBACK");
      throw new Error(`Insufficient balance: have ${currentBalance}, need ${amount}`);
    }

    const newBalance = currentBalance - amount;

    await client.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, reference_type, reference_id, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, type, -amount, newBalance, referenceType ?? null, referenceId ?? null, description]
    );

    await client.query("COMMIT");
    return newBalance;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getTransactionHistory(
  userId: number,
  limit: number = 50,
) {
  return db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(desc(transactionsTable.id))
    .limit(limit);
}
