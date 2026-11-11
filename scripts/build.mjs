import { readFileSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const css = ['styles','extensions','profile','content','community','calendar','activity','management','performance','campus','messaging','cycles'].map(name=>read('ui/'+name+'.css')).join('\n');
const client = read('ui/app.js').replace('  // EXTENSIONS_SLOT', ['extensions','profile','content','community','calendar','activity','management','performance','campus','messaging','cycles'].map(name=>read('ui/'+name+'.js')).join('\n'));
new Script(client, { filename: 'atlas-client.js' });
const version = createHash('sha256').update(css + client).digest('hex').slice(0, 12);
const html = read('ui/index.html')
  .replace('./styles.css', '/styles.css?v=' + version)
  .replace('./app.js', '/app.js?v=' + version);
const api = ['api','calendar','activity','management','campus','messaging','cycles'].map(name=>read('worker/'+name+'.js')).join('\n');
new Script(api, { filename: 'kamporia-api.js' });

const entry = `
const PAGE_HTML = ${JSON.stringify(html)};
const PAGE_CSS = ${JSON.stringify(css)};
const PAGE_JS = ${JSON.stringify(client)};

${api}

const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'",
};

function asset(body, type) {
  return new Response(body, { headers: { ...securityHeaders, 'content-type': type, 'cache-control': 'public, max-age=3600' } });
}

export default {
  async fetch(request, env, ctx) {
    void ctx;
    const path = new URL(request.url).pathname;
    try {
      if (path.startsWith('/api/')) {
        const response = await handleApi(request, env);
        for (const [key, value] of Object.entries(securityHeaders)) response.headers.set(key, value);
        response.headers.set('cache-control', 'no-store');
        return response;
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405, headers: securityHeaders });
      if (path === '/' || path === '/index.html') {
        const response = asset(PAGE_HTML, 'text/html; charset=utf-8');
        response.headers.set('cache-control', 'no-cache');
        return response;
      }
      if (path === '/styles.css') return asset(PAGE_CSS, 'text/css; charset=utf-8');
      if (path === '/app.js') return asset(PAGE_JS, 'text/javascript; charset=utf-8');
      if (path === '/favicon.svg') return asset('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><rect width="44" height="44" rx="12" fill="#5a58df"/><path d="M10 9h7v12L29 9h9L23 23l15 12H28L17 25v10h-7V9Z" fill="white"/></svg>', 'image/svg+xml');
      return new Response('Not Found', { status: 404, headers: securityHeaders });
    } catch (error) {
      console.error('Worker request failed:', error);
      return new Response(JSON.stringify({ error: 'Внутренняя ошибка сервера' }), { status: 500, headers: { ...securityHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    }
  },
};
`;

mkdirSync(join(root, 'dist/server'), { recursive: true });
mkdirSync(join(root, 'dist/.openai'), { recursive: true });
writeFileSync(join(root, 'dist/server/index.js'), entry);
cpSync(join(root, '.openai/hosting.json'), join(root, 'dist/.openai/hosting.json'));
console.log('Built dependency-free Worker at dist/server/index.js');
