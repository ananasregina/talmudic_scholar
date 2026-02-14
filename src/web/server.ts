import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { cors } from 'hono/cors';
import { readFile } from 'fs/promises';
import { ragQuery } from '../services/rag.js';
import { closePool } from '../db/init.js';

const app = new Hono();
const PORT = Number(process.env.PORT) || 3000;

app.use('/*', cors());

app.get('/api/query', async (c) => {
  const q = c.req.query('q');
  if (!q) {
    return c.json({ error: 'Missing query parameter "q"' }, 400);
  }
  
  try {
    const answer = await ragQuery(q);
    return c.json({ answer });
  } catch (error) {
    console.error('Query error:', error);
    return c.json({ error: 'Failed to process query' }, 500);
  }
});

app.use('/*', serveStatic({ root: './src/web/public' }));

app.notFound(async (c) => {
  try {
    const html = await readFile('./src/web/public/index.html', 'utf-8');
    return c.html(html);
  } catch {
    return c.text('Not Found', 404);
  }
});

let server: ReturnType<typeof serve>;
const shutdown = async (signal: string) => {
  console.log(`\n🛑 ${signal} received, shutting down...`);
  server?.close();
  await closePool();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server = serve({ fetch: app.fetch, port: PORT });
console.log(`🕯️  Talmudic Scholar Web: http://localhost:${PORT}`);
