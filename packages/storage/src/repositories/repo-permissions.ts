import type Database from "better-sqlite3";
import type { PermissionConfig } from "@rivonclaw/core";

interface PermissionRow {
  id: number;
  read_paths: string;
  write_paths: string;
}

function rowToPermission(row: PermissionRow): PermissionConfig {
  return {
    readPaths: JSON.parse(row.read_paths) as string[],
    writePaths: JSON.parse(row.write_paths) as string[],
  };
}

export class PermissionsRepository {
  constructor(private db: Database.Database) {}

  get(): PermissionConfig {
    const row = this.db
      .prepare("SELECT * FROM permissions WHERE id = 1")
      .get() as PermissionRow | undefined;

    if (!row) {
      // Should not happen due to migration, but handle gracefully
      return { readPaths: [], writePaths: [] };
    }

    return rowToPermission(row);
  }

  update(config: PermissionConfig): PermissionConfig {
    this.db
      .prepare(
        "UPDATE permissions SET read_paths = ?, write_paths = ? WHERE id = 1",
      )
      .run(
        JSON.stringify(config.readPaths),
        JSON.stringify(config.writePaths),
      );

    return config;
  }
}
