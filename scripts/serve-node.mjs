// Run the same compiled Worker on a single Node.js VM with a persistent SQLite file.
// No external npm packages are needed. Use Node.js 24 or later.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const trustProxy = process.env.TRUST_PROXY === '1';
const publicOrigin = process.env.PUBLIC_ORIGIN || '';
const maxBodyBytes = 6 * 1024 * 1024;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}
if (trustProxy && !['127.0.0.1', '::1', 'localhost'].includes(host) && !publicOrigin) {
  throw new Error('TRUST_PROXY on a non-loopback listener requires PUBLIC_ORIGIN');
}
if (publicOrigin) {
  const parsed = new URL(publicOrigin);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('PUBLIC_ORIGIN must be an http(s) origin without a path');
  }
}

const configuredPath = process.env.DATABASE_PATH || join(root, '.data', 'atlas.sqlite');
const databasePath = isAbsolute(configuredPath) ? configuredPath : resolve(root, configuredPath);
const entryPath = join(root, 'dist', 'server', 'index.js');
const migrationDir = join(root, 'drizzle');
if (!existsSync(entryPath)) throw new Error('Missing dist/server/index.js. Run `node scripts/build.mjs` first.');
if (!existsSync(migrationDir)) throw new Error('Missing drizzle migrations. Refusing to start without a schema.');

mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
const sqlite = new DatabaseSync(databasePath, { timeout: 5000 });
try { chmodSync(databasePath, 0o600); } catch { /* Windows ignores POSIX file modes. */ }
sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');

function applyMigrations() {
  sqlite.exec('CREATE TABLE IF NOT EXISTS _atlas_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const files = readdirSync(migrationDir).filter((name) => /^\d+[_-].+\.sql$/.test(name)).sort();
  if (files.length === 0) throw new Error('No SQL migration found in drizzle/.');
  for (const name of files) {
    if (sqlite.prepare('SELECT 1 FROM _atlas_migrations WHERE name = ?').get(name)) continue;
    const sql = readFileSync(join(migrationDir, name), 'utf8');
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      sqlite.exec(sql);
      sqlite.prepare('INSERT INTO _atlas_migrations (name) VALUES (?)').run(name);
      sqlite.exec('COMMIT');
      console.log(`Applied database migration ${name}`);
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw new Error(`Database migration ${name} failed: ${error.message}`, { cause: error });
    }
  }
}

try {
  applyMigrations();
} catch (error) {
  sqlite.close();
  throw error;
}

function d1Statement(sql) {
  let args = [];
  const statement = {
    bind(...values) { args = values; return statement; },
    async first(column) {
      const row = sqlite.prepare(sql).get(...args) ?? null;
      return column ? row?.[column] ?? null : row;
    },
    async all() {
      const results = sqlite.prepare(sql).all(...args);
      const meta = sqlite.prepare('SELECT changes() AS changes, last_insert_rowid() AS last_row_id').get();
      return { success: true, results, meta: { changes: meta.changes, last_row_id: Number(meta.last_row_id) } };
    },
    async run() {
      const result = sqlite.prepare(sql).run(...args);
      return { success: true, meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) } };
    },
    async raw() { return (await statement.all()).results.map((row) => Object.values(row)); },
    // Used only by the batch shim; each statement is executed once.
    async _batchExecute() {
      const prepared = sqlite.prepare(sql);
      return prepared.columns().length ? statement.all() : statement.run();
    },
  };
  return statement;
}

const DB = {
  prepare: d1Statement,
  async batch(statements) {
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement._batchExecute());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  },
  async exec(sql) { sqlite.exec(sql); return { count: 1, duration: 0 }; },
};

// Local equivalent of the R2 binding. Only generated upload UUID keys are
// accepted; user file names never become filesystem paths.
const bucketPath = resolve(process.env.BUCKET_PATH || `${databasePath}.files`);
mkdirSync(bucketPath, { recursive: true, mode: 0o700 });
function bucketFile(key) {
  if (!/^uploads\/[a-f0-9-]{36}$/.test(key)) throw new Error('Invalid object key');
  return join(bucketPath, key.slice('uploads/'.length));
}
const BUCKET = {
  async put(key, value) {
    const target = bucketFile(key);
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    writeFileSync(temporary, bytes, { mode: 0o600 });
    renameSync(temporary, target);
    return { key, size: bytes.byteLength };
  },
  async get(key) {
    const target = bucketFile(key);
    if (!existsSync(target)) return null;
    return { body: new Uint8Array(readFileSync(target)) };
  },
  async delete(key) {
    const target = bucketFile(key);
    if (existsSync(target)) unlinkSync(target);
  },
};

const worker = (await import(pathToFileURL(entryPath).href)).default;
if (!worker || typeof worker.fetch !== 'function') {
  sqlite.close();
  throw new Error('Compiled Worker must default-export a fetch handler.');
}

function validatedHost(value) {
  if (!value || /[\s/@?#]/.test(value)) throw Object.assign(new Error('Invalid Host header'), { status: 400 });
  try {
    const parsed = new URL(`http://${value}`);
    if (parsed.username || parsed.password || parsed.pathname !== '/') throw new Error('Invalid Host header');
    return parsed.host;
  } catch {
    throw Object.assign(new Error('Invalid Host header'), { status: 400 });
  }
}

function requestOrigin(req) {
  if (publicOrigin) return new URL(publicOrigin).origin;
  const forwardedProto = trustProxy && req.headers['x-forwarded-proto']
    ? String(req.headers['x-forwarded-proto']).split(',')[0].trim()
    : 'http';
  if (!['http', 'https'].includes(forwardedProto)) throw Object.assign(new Error('Invalid forwarded protocol'), { status: 400 });
  const hostHeader = trustProxy && req.headers['x-forwarded-host']
    ? String(req.headers['x-forwarded-host']).split(',')[0].trim()
    : String(req.headers.host || '');
  return `${forwardedProto}://${validatedHost(hostHeader)}`;
}

async function readBody(req) {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBodyBytes) {
    const error = new Error('Payload too large');
    error.status = 413;
    throw error;
  }
  const parts = [];
  let size = 0;
  for await (const part of req) {
    size += part.length;
    if (size > maxBodyBytes) {
      const error = new Error('Payload too large');
      error.status = 413;
      throw error;
    }
    parts.push(part);
  }
  return Buffer.concat(parts);
}

const server = createServer(async (req, res) => {
  try {
    // A browser request target must be an origin-form path. Reject proxy-style absolute URLs.
    if (!req.url?.startsWith('/') || req.url.startsWith('//')) throw Object.assign(new Error('Invalid request target'), { status: 400 });
    const origin = requestOrigin(req);
    const url = `${origin}${req.url}`;
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
    const request = new Request(url, { method: req.method, headers: req.headers, body });
    const response = await worker.fetch(request, { DB, BUCKET }, {});
    res.statusCode = response.status;
    for (const [key, value] of response.headers) {
      if (key.toLowerCase() !== 'set-cookie') res.setHeader(key, value);
    }
    const cookies = response.headers.getSetCookie?.() || [];
    if (cookies.length) res.setHeader('set-cookie', cookies);
    else if (response.headers.has('set-cookie')) res.setHeader('set-cookie', response.headers.get('set-cookie'));
    if (req.method === 'HEAD') return res.end();
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = error.status === 400 || error.status === 413 ? error.status : 500;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      res.end(res.statusCode === 500 ? 'Internal Server Error' : error.message);
    } else res.destroy();
    if (error.status !== 400 && error.status !== 413) console.error('Request failed:', error);
  }
});
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 100;

server.on('error', (error) => {
  console.error('HTTP server failed:', error);
  sqlite.close();
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`Atlas listening on http://${host}:${port}; database: ${databasePath}`);
});

let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`Received ${signal}; draining HTTP connections`);
  const deadline = setTimeout(() => server.closeAllConnections?.(), 15_000);
  deadline.unref();
  server.close(() => {
    clearTimeout(deadline);
    try { sqlite.close(); } catch (error) { console.error('Database close failed:', error); process.exitCode = 1; }
    console.log('Atlas stopped');
  });
  server.closeIdleConnections?.();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
