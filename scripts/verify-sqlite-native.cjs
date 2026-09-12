const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");

const sqliteDir = process.argv[2];
if (!sqliteDir) throw new Error("Usage: node --expose-gc scripts/verify-sqlite-native.cjs <better-sqlite3 directory>");
const fromSqlite = createRequire(path.join(sqliteDir, "package.json"));
const Database = fromSqlite(sqliteDir);
const version = fromSqlite(path.join(sqliteDir, "package.json")).version;
const text = "text-\u4e2d\ud83d\ude80\u0000tail";
for (let pass = 0; pass < 30; pass++) {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE test(value TEXT, n INTEGER)");
  db.prepare("INSERT INTO test VALUES (@value, @n)").run({ value: text, n: pass });
  assert.deepEqual(db.prepare("SELECT value, n FROM test").get(), { value: text, n: pass });
  for (let i = 0; i < 500; i++) {
    assert.equal(db.prepare("SELECT ? AS n").get(i).n, i);
  }
  // Collect statements while their database is live, then collect after close.
  global.gc?.();
  db.close();
  global.gc?.();
}
console.log(`[verify-sqlite-native] better-sqlite3 ${version}, ${process.versions.electron ? `Electron ${process.versions.electron}` : `Node ${process.versions.node}`}, N-API ${process.versions.napi}: bindings and GC passed`);
