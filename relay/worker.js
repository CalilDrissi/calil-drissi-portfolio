// Standalone Worker: WebSocket relay pairing a desktop player (role=host) with a
// phone controller (role=controller) by room code. Durable Object per room.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const room = (url.searchParams.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (!room) return new Response('missing room', { status: 400 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    return env.ARCADE_RELAY.get(env.ARCADE_RELAY.idFromName(room)).fetch(request);
  }
};
export class ArcadeRelay {
  constructor(state, env) { this.sessions = new Set(); }
  async fetch(request) {
    const role = (new URL(request.url).searchParams.get('role') || 'peer').slice(0, 16);
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    this.sessions.add(server);
    try { server.send(JSON.stringify({ t: 'joined', role, peers: this.sessions.size - 1 })); } catch (_) {}
    this._b(server, JSON.stringify({ t: 'peer', role, state: 'connected' }));
    server.addEventListener('message', e => this._b(server, e.data));
    const bye = () => { if (this.sessions.delete(server)) this._b(server, JSON.stringify({ t: 'peer', role, state: 'disconnected' })); };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }
  _b(from, data) { for (const s of this.sessions) if (s !== from) { try { if (s.readyState === 1) s.send(data); } catch (_) {} } }
}
