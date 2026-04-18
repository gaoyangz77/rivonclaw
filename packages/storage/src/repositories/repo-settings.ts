import type Database from "better-sqlite3";

interface SettingRow {
  key: string;
  value: string;
}

export class SettingsRepository {
  constructor(private db: Database.Database) {}

  get(key: string): string | undefined {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(key) as SettingRow | undefined;
    return row?.value;
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(key, value);
  }

  getAll(): Record<string, string> {
    const rows = this.db
      .prepare("SELECT key, value FROM settings ORDER BY key ASC")
      .all() as SettingRow[];

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  delete(key: string): boolean {
    const result = this.db
      .prepare("DELETE FROM settings WHERE key = ?")
      .run(key);
    return result.changes > 0;
  }
}
