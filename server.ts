import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { RoomManager } from './platform/server/RoomManager.ts';
import { PLATFORM_CONFIG } from './platform/shared/config.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const isProd = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = express();
  const server = http.createServer(app);
  const roomManager = new RoomManager();
  await roomManager.init();

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, rooms: roomManager.getOpenRoomsList().length });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: roomManager.getOpenRoomsList() });
  });

  // WebSocket server at /ws
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: PLATFORM_CONFIG.limits.maxMessageBytes,
  });

  wss.on('connection', (ws, req) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const check = roomManager.canAcceptConnection(ip);
    if (!check.ok) {
      ws.close(4009, check.reason ?? 'Too many connections');
      return;
    }
    roomManager.registerConnection(ws, ip);
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Office Arena] Server listening on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });

  process.on('SIGTERM', () => {
    roomManager.shutdown();
    server.close();
  });
}

bootstrap().catch((err) => {
  console.error('[Office Arena] Fatal startup error:', err);
  process.exit(1);
});
