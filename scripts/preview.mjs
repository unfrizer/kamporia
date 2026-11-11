// The preview and portable deployment use the same D1/R2-compatible adapter.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
process.env.DATABASE_PATH ||= join(dirname(fileURLToPath(import.meta.url)), '..', '.data', 'preview.sqlite');
await import('./serve-node.mjs');
