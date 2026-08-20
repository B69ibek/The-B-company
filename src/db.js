// Simple, dependency-free file-based data store.
// Design choice: every data category lives in its own JSON file inside /data,
// exactly as requested — shipments, buyers, sellers, suppliers, interstate
// trade records, user accounts, and the login/audit log are all separate files.
// Writes are atomic (write to a temp file, then rename) to avoid corrupting
// a file if the process is interrupted mid-write.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const FILES = {
  users: 'users.json',
  shipments: 'shipments.json',
  buyers: 'buyers.json',
  sellers: 'sellers.json',
  suppliers: 'suppliers.json',
  interstateTrade: 'interstate_trade.json',
  auditLog: 'audit_log.json'
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o750 });
  }
  for (const file of Object.values(FILES)) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]', { mode: 0o640 });
    }
  }
}

function filePathFor(collection) {
  if (!FILES[collection]) throw new Error(`Unknown collection: ${collection}`);
  return path.join(DATA_DIR, FILES[collection]);
}

function readAll(collection) {
  const filePath = filePathFor(collection);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw.trim() ? JSON.parse(raw) : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function writeAll(collection, records) {
  const filePath = filePathFor(collection);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(records, null, 2), { mode: 0o640 });
  fs.renameSync(tmpPath, filePath); // atomic on same filesystem
}

function insert(collection, record) {
  const records = readAll(collection);
  records.push(record);
  writeAll(collection, records);
  return record;
}

function update(collection, id, patch) {
  const records = readAll(collection);
  const idx = records.findIndex(r => r.id === id);
  if (idx === -1) return null;
  records[idx] = { ...records[idx], ...patch, id: records[idx].id };
  writeAll(collection, records);
  return records[idx];
}

function remove(collection, id) {
  const records = readAll(collection);
  const next = records.filter(r => r.id !== id);
  const removed = next.length !== records.length;
  if (removed) writeAll(collection, next);
  return removed;
}

function findOne(collection, predicate) {
  return readAll(collection).find(predicate) || null;
}

module.exports = {
  DATA_DIR,
  FILES,
  ensureDataDir,
  readAll,
  writeAll,
  insert,
  update,
  remove,
  findOne
};
