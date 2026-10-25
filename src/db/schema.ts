import * as SQLite from 'expo-sqlite';

// All data stays on the device. Nothing leaves the phone unless the user exports it.
export const DB_NAME = 'migraine.db';

const MIGRATIONS: string[] = [
  // v1 — core tables
  `
  CREATE TABLE IF NOT EXISTS attack (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at  TEXT NOT NULL,              -- ISO 8601
    ended_at    TEXT,                       -- null = ongoing
    intensity   INTEGER NOT NULL CHECK (intensity BETWEEN 0 AND 10),
    locations   TEXT NOT NULL DEFAULT '[]', -- JSON array: ["left","temple"]
    aura        INTEGER NOT NULL DEFAULT 0, -- boolean
    symptoms    TEXT NOT NULL DEFAULT '[]', -- JSON array
    notes       TEXT,
    logged_via  TEXT NOT NULL DEFAULT 'tap' -- tap | voice | watch
  );

  CREATE TABLE IF NOT EXISTS phase (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    attack_id   INTEGER NOT NULL REFERENCES attack(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('prodrome','pain','postdrome')),
    started_at  TEXT NOT NULL,
    symptoms    TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS medication (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    class         TEXT NOT NULL,            -- triptan | nsaid | acetaminophen | other
    monthly_limit INTEGER                   -- days/month before overuse warning
  );

  CREATE TABLE IF NOT EXISTS medication_dose (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id INTEGER NOT NULL REFERENCES medication(id),
    attack_id     INTEGER REFERENCES attack(id) ON DELETE SET NULL,
    taken_at      TEXT NOT NULL,
    relief_score  INTEGER CHECK (relief_score BETWEEN 0 AND 10)
  );

  -- One row per day, mostly auto-filled from Health data + phone sensors later
  CREATE TABLE IF NOT EXISTS daily_context (
    date           TEXT PRIMARY KEY,        -- YYYY-MM-DD
    sleep_start    TEXT,
    sleep_end      TEXT,
    sleep_quality  INTEGER,
    shift_type     TEXT CHECK (shift_type IN ('day','night','off')),
    pressure_delta REAL,                    -- hPa change over 24h
    hrv            REAL,
    steps          INTEGER,
    cycle_day      INTEGER,
    caffeine_mg    INTEGER,
    water_ml       INTEGER,
    stress_level   INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_attack_started ON attack(started_at);
  CREATE INDEX IF NOT EXISTS idx_dose_taken ON medication_dose(taken_at);
  `,
];

export async function openDb() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  // SQLite resets this per connection, so it must run on every open.
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < MIGRATIONS.length) {
    await db.execAsync(MIGRATIONS[version]);
    version++;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
  return db;
}
