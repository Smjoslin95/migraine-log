import type { SQLiteDatabase } from 'expo-sqlite';

export type Attack = {
  id: number;
  started_at: string;
  ended_at: string | null;
  intensity: number;
  locations: string;   // JSON array
  aura: number;        // 0 | 1
  symptoms: string;    // JSON array
  notes: string | null;
  logged_via: string;
};

export type AttackPatch = Partial<{
  intensity: number;
  locations: string[];
  aura: boolean;
  symptoms: string[];
  notes: string;
  started_at: string;
  ended_at: string | null;
}>;

export const parseList = (json: string | null | undefined): string[] => {
  try {
    const v = JSON.parse(json ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

// One-tap log: just intensity. Everything else can be filled in later.
export async function quickLog(db: SQLiteDatabase, intensity: number) {
  const res = await db.runAsync(
    'INSERT INTO attack (started_at, intensity) VALUES (?, ?)',
    new Date().toISOString(),
    intensity
  );
  return res.lastInsertRowId;
}

export async function endAttack(db: SQLiteDatabase, id: number) {
  await db.runAsync('UPDATE attack SET ended_at = ? WHERE id = ?', new Date().toISOString(), id);
}

export async function getAttack(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Attack>('SELECT * FROM attack WHERE id = ?', id);
}

export async function updateAttack(db: SQLiteDatabase, id: number, patch: AttackPatch) {
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  const add = (col: string, v: string | number | null) => { sets.push(`${col} = ?`); vals.push(v); };

  if (patch.intensity !== undefined) add('intensity', patch.intensity);
  if (patch.locations !== undefined) add('locations', JSON.stringify(patch.locations));
  if (patch.aura !== undefined) add('aura', patch.aura ? 1 : 0);
  if (patch.symptoms !== undefined) add('symptoms', JSON.stringify(patch.symptoms));
  if (patch.notes !== undefined) add('notes', patch.notes);
  if (patch.started_at !== undefined) add('started_at', patch.started_at);
  if (patch.ended_at !== undefined) add('ended_at', patch.ended_at);
  if (!sets.length) return;

  await db.runAsync(`UPDATE attack SET ${sets.join(', ')} WHERE id = ?`, ...vals, id);
}

export async function deleteAttack(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM attack WHERE id = ?', id);
}

export async function getOngoing(db: SQLiteDatabase) {
  return db.getFirstAsync<Attack>(
    'SELECT * FROM attack WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1'
  );
}

export async function recentAttacks(db: SQLiteDatabase, limit = 30) {
  return db.getAllAsync<Attack>('SELECT * FROM attack ORDER BY started_at DESC LIMIT ?', limit);
}
