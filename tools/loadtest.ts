import WebSocket from 'ws';

function parseArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) {
    const val = Number(process.argv[idx + 1]);
    if (!Number.isNaN(val) && val > 0) return val;
  }
  return fallback;
}

const NUM_ROOMS = parseArg('rooms', 5);
const PLAYERS_PER_ROOM = parseArg('players', 12);
const DURATION_SEC = parseArg('duration', 10);
const WS_URL = process.env.WS_URL ?? 'ws://127.0.0.1:3000/ws';

interface BotClient {
  ws: WebSocket;
  playerId: string;
  seq: number;
  fire: number;
}

async function runRoom(roomIndex: number): Promise<{ bytesReceived: number; errors: number; snapshots: number }> {
  return new Promise((resolve) => {
    let bytesReceived = 0;
    let errors = 0;
    let snapshots = 0;
    let roomCode = '';
    const clients: BotClient[] = [];
    let inputTimer: ReturnType<typeof setInterval> | null = null;

    const hostWs = new WebSocket(WS_URL);
    const hostClient: BotClient = { ws: hostWs, playerId: '', seq: 0, fire: 0 };
    clients.push(hostClient);

    hostWs.on('open', () => {
      hostWs.send(
        JSON.stringify({
          type: 'createRoom',
          gameId: 'tank-arena',
          options: {
            name: `LoadRoom-${roomIndex}`,
            visibility: 'private',
            maxPlayers: PLAYERS_PER_ROOM,
            startRule: 'host',
          },
          profile: {
            nickname: `Host${roomIndex}`,
            colorId: 'red',
            iconId: 'shield',
            controlStyle: 'PC_STANDARD',
            device: 'pc',
          },
        }),
      );
    });

    hostWs.on('message', (data) => {
      bytesReceived += Buffer.byteLength(data as Buffer);
      const msg = JSON.parse(data.toString()) as { type: string; code?: string; room?: { code: string; players: unknown[] }; message?: string };
      if (msg.type === 'error') errors += 1;
      if (msg.type === 'snapshot') snapshots += 1;
      if (msg.type === 'roomJoined' && msg.room && !roomCode) {
        roomCode = msg.room.code;
        // Spawn remaining players
        for (let p = 1; p < PLAYERS_PER_ROOM; p++) {
          const ws = new WebSocket(WS_URL);
          const client: BotClient = { ws, playerId: '', seq: 0, fire: 0 };
          clients.push(client);
          ws.on('open', () => {
            ws.send(
              JSON.stringify({
                type: 'joinRoom',
                code: roomCode,
                profile: {
                  nickname: `Bot${roomIndex}_${p}`,
                  colorId: p % 2 === 0 ? 'red' : 'blue',
                  iconId: 'bot',
                  controlStyle: 'PC_STANDARD',
                  device: 'pc',
                },
              }),
            );
          });
          ws.on('message', (d) => {
            bytesReceived += Buffer.byteLength(d as Buffer);
            const m = JSON.parse(d.toString()) as { type: string };
            if (m.type === 'error') errors += 1;
            if (m.type === 'snapshot') snapshots += 1;
            if (m.type === 'roomJoined') {
              ws.send(JSON.stringify({ type: 'setReady', ready: true }));
            }
            if (m.type === 'loading') {
              ws.send(JSON.stringify({ type: 'loaded' }));
            }
          });
          ws.on('error', () => {
            errors += 1;
          });
        }

        // Start match after joiners settle
        setTimeout(() => {
          hostWs.send(JSON.stringify({ type: 'startMatch', force: true }));
        }, 1200);
      }

      if (msg.type === 'loading') {
        hostWs.send(JSON.stringify({ type: 'loaded' }));
      }
      if (msg.type === 'matchStart' && !inputTimer) {
        inputTimer = setInterval(() => {
          for (const c of clients) {
            if (c.ws.readyState === 1) {
              c.seq += 1;
              if (c.seq % 15 === 0) c.fire += 1;
              c.ws.send(
                JSON.stringify({
                  type: 'input',
                  t: Date.now(),
                  payload: [c.seq, 1, Math.sin(c.seq * 0.1), null, c.fire],
                }),
              );
            }
          }
        }, 33);
      }
    });

    hostWs.on('error', () => {
      errors += 1;
    });

    setTimeout(() => {
      if (inputTimer) clearInterval(inputTimer);
      for (const c of clients) {
        try {
          c.ws.close();
        } catch {}
      }
      resolve({ bytesReceived, errors, snapshots });
    }, DURATION_SEC * 1000);
  });
}

async function main() {
  console.log(`[LoadTest] Spawning ${NUM_ROOMS} rooms x ${PLAYERS_PER_ROOM} players for ${DURATION_SEC}s against ${WS_URL}...`);
  const start = Date.now();
  const results = await Promise.all(Array.from({ length: NUM_ROOMS }, (_, i) => runRoom(i + 1)));
  const elapsedSec = (Date.now() - start) / 1000;

  const totalBytes = results.reduce((s, r) => s + r.bytesReceived, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors, 0);
  const totalSnapshots = results.reduce((s, r) => s + r.snapshots, 0);
  const totalClients = NUM_ROOMS * PLAYERS_PER_ROOM;
  const kbPerSecPerClient = totalBytes / 1024 / elapsedSec / totalClients;

  console.log('--- Load Test Report ---');
  console.log(`Rooms: ${NUM_ROOMS} | Total Clients: ${totalClients} | Elapsed: ${elapsedSec.toFixed(1)}s`);
  console.log(`Total Snapshots Received: ${totalSnapshots}`);
  console.log(`Bandwidth per client: ${kbPerSecPerClient.toFixed(2)} KB/s (target < 15 KB/s)`);
  console.log(`Errors: ${totalErrors}`);
  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
