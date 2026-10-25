import type { SQLiteDatabase } from 'expo-sqlite';

export type MedClass = 'triptan' | 'nsaid' | 'acetaminophen' | 'combination' | 'opioid' | 'other';

export type Medication = {
  id: number;
  name: string;
  class: MedClass;
  monthly_limit: number | null;
};

export type DoseRow = {
  id: number;
  medication_id: number;
  name: string;
  class: MedClass;
  taken_at: string;
  attack_id: number | null;
  relief_score: number | null;
};

// Medication-overuse headache thresholds (ICHD-3): treatment days per month.
// Triptans, opioids and combination analgesics: 10+ days. Simple analgesics: 15+ days.
// The user can override per medication if their doctor gives a different number.
export const DEFAULT_LIMITS: Record<MedClass, number> = {
  triptan: 10,
  opioid: 10,
  combination: 10,
  nsaid: 15,
  acetaminophen: 15,
  other: 15,
};

export const CLASS_LABELS: Record<MedClass, string> = {
  triptan: 'Triptan',
  nsaid: 'NSAID (ibuprofen, naproxen…)',
  acetaminophen: 'Acetaminophen',
  combination: 'Combination (e.g. with caffeine)',
  opioid: 'Opioid',
  other: 'Other',
};

export async function listMeds(db: SQLiteDatabase) {
  return db.getAllAsync<Medication>('SELECT * FROM medication ORDER BY name');
}

export async function addMed(db: SQLiteDatabase, name: string, cls: MedClass, limit?: number) {
  const res = await db.runAsync(
    'INSERT INTO medication (name, class, monthly_limit) VALUES (?, ?, ?)',
    name.trim(),
    cls,
    limit ?? DEFAULT_LIMITS[cls]
  );
  return res.lastInsertRowId;
}

export async function deleteMed(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM medication_dose WHERE medication_id = ?', id);
  await db.runAsync('DELETE FROM medication WHERE id = ?', id);
}

export async function logDose(db: SQLiteDatabase, medicationId: number, attackId?: number | null) {
  const res = await db.runAsync(
    'INSERT INTO medication_dose (medication_id, attack_id, taken_at) VALUES (?, ?, ?)',
    medicationId,
    attackId ?? null,
    new Date().toISOString()
  );
  return res.lastInsertRowId;
}

export async function setRelief(db: SQLiteDatabase, doseId: number, score: number) {
  await db.runAsync('UPDATE medication_dose SET relief_score = ? WHERE id = ?', score, doseId);
}

export async function deleteDose(db: SQLiteDatabase, doseId: number) {
  await db.runAsync('DELETE FROM medication_dose WHERE id = ?', doseId);
}

export async function recentDoses(db: SQLiteDatabase, limit = 20) {
  return db.getAllAsync<DoseRow>(
    `SELECT d.id, d.medication_id, m.name, m.class, d.taken_at, d.attack_id, d.relief_score
       FROM medication_dose d JOIN medication m ON m.id = d.medication_id
      ORDER BY d.taken_at DESC LIMIT ?`,
    limit
  );
}

export async function dosesForAttack(db: SQLiteDatabase, attackId: number) {
  return db.getAllAsync<DoseRow>(
    `SELECT d.id, d.medication_id, m.name, m.class, d.taken_at, d.attack_id, d.relief_score
       FROM medication_dose d JOIN medication m ON m.id = d.medication_id
      WHERE d.attack_id = ? ORDER BY d.taken_at`,
    attackId
  );
}

// ---------- Overuse ----------

export type OveruseLevel = 'ok' | 'caution' | 'warning' | 'over';

export type OveruseStatus = {
  key: string;        // med class, or "all-acute"
  label: string;
  days: number;       // distinct treatment days in the last 30
  limit: number;
  level: OveruseLevel;
};

function levelFor(days: number, limit: number): OveruseLevel {
  if (days >= limit) return 'over';
  if (days >= limit - 2) return 'warning';      // 2 days away
  if (days >= Math.ceil(limit * 0.6)) return 'caution';
  return 'ok';
}

// Counts *days*, not doses — that's how overuse is defined clinically.
// Uses local calendar days so a 11pm dose and a 1am dose count as two days.
export async function overuseStatus(db: SQLiteDatabase): Promise<OveruseStatus[]> {
  const rows = await db.getAllAsync<{ class: MedClass; day: string; limit_min: number }>(
    `SELECT m.class AS class,
            date(d.taken_at, 'localtime') AS day,
            MIN(COALESCE(m.monthly_limit, 15)) AS limit_min
       FROM medication_dose d JOIN medication m ON m.id = d.medication_id
      WHERE datetime(d.taken_at) >= datetime('now', '-30 days')
      GROUP BY m.class, day`
  );

  const byClass = new Map<MedClass, { days: Set<string>; limit: number }>();
  const allDays = new Set<string>();
  for (const r of rows) {
    const entry = byClass.get(r.class) ?? { days: new Set(), limit: r.limit_min };
    entry.days.add(r.day);
    entry.limit = Math.min(entry.limit, r.limit_min);
    byClass.set(r.class, entry);
    allDays.add(r.day);
  }

  const out: OveruseStatus[] = [];
  for (const [cls, { days, limit }] of byClass) {
    out.push({ key: cls, label: CLASS_LABELS[cls], days: days.size, limit, level: levelFor(days.size, limit) });
  }

  // Mixing classes also counts: 10+ days of any combination of acute meds.
  if (byClass.size > 1) {
    out.push({
      key: 'all-acute',
      label: 'All pain meds combined',
      days: allDays.size,
      limit: 10,
      level: levelFor(allDays.size, 10),
    });
  }

  const rank: Record<OveruseLevel, number> = { over: 0, warning: 1, caution: 2, ok: 3 };
  return out.sort((a, b) => rank[a.level] - rank[b.level] || b.days - a.days);
}

export function worstLevel(statuses: OveruseStatus[]): OveruseLevel {
  return statuses[0]?.level ?? 'ok';
}
