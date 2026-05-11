import path from "node:path";
import { fileURLToPath } from "node:url";
import configLoader from "../config-loader.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..");

let _writable = null;
let _readonly = null;
let _DatabaseClass = null;

function resolveDbPath() {
  const config = configLoader.load();
  const dbPath = config.DbPath || "igt_data.db";
  return path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
}

async function getDatabaseClass() {
  if (!_DatabaseClass) {
    _DatabaseClass = (await import("better-sqlite3")).default;
  }
  return _DatabaseClass;
}

export async function getDb({ readonly = false } = {}) {
  const Database = await getDatabaseClass();
  if (readonly) {
    if (!_readonly) {
      _readonly = new Database(resolveDbPath(), { readonly: true });
    }
    return _readonly;
  }
  if (!_writable) {
    _writable = new Database(resolveDbPath());
    _writable.pragma("journal_mode = WAL");
  }
  return _writable;
}

export function closeAll() {
  if (_writable) { _writable.close(); _writable = null; }
  if (_readonly) { _readonly.close(); _readonly = null; }
}
