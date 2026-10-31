/* Połączenie telefon hosta → telewizor (tryb jednego telefonu).
   1) PeerJS (WebRTC) – kod/QR z ekranu TV
   2) BroadcastChannel – ekran TV w drugiej karcie tej samej przeglądarki (testy) */
(() => {
'use strict';
const CFG = window.IMPOSTOR_CONFIG || {};
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

window.TVLink = {
  /** opts: { getState: () => obj, onStatus: (txt, ok) => void } */
  init(opts) {
    const T = { bc: null, lastHello: 0, peer: null, conn: null, code: '', status: '', retry: null, err: '' };
    const open = () => !!(T.conn && T.conn.open);
    const status = () => {
      const on = open() ? 'TV ' + T.code : Date.now() - T.lastHello < 9000 ? 'karta TV' : '';
      opts.onStatus && opts.onStatus(on || T.status || '', !!on);
    };
    const sync = () => {
      const msg = { type: 'state', state: opts.getState() };
      try { if (T.bc) T.bc.postMessage(msg); } catch (e) {}
      if (open()) { try { T.conn.send(msg); } catch (e) {} }
    };
    try {
      T.bc = new BroadcastChannel('impostor-tv');
      T.bc.onmessage = e => { if (e.data && e.data.type === 'hello') { T.lastHello = Date.now(); sync(); status(); } };
    } catch (e) {}
    setInterval(() => { sync(); status(); }, 3000);

    let lib = null;
    const loadPeer = () => window.Peer ? Promise.resolve() : (lib = lib || new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = CFG.PEERJS_URL || 'js/vendor/peerjs.min.js';
      s.onload = res; s.onerror = () => { lib = null; rej(new Error('peerjs')); }; document.head.appendChild(s);
    }));
    const setS = s => { T.status = s; status(); };
    const retryLater = () => { clearTimeout(T.retry); if (T.code) T.retry = setTimeout(() => connect(T.code), 4000); };
    function connect(code) {
      code = normCode(code); if (!code) return;
      clearTimeout(T.retry);
      if (T.conn && T.code === code && T.conn.open) return;
      if (T.conn) { const o = T.conn; T.conn = null; try { o.close(); } catch (e) {} }
      T.code = code; setS('łączenie z ' + code + '…');
      loadPeer().then(() => {
        const go = () => {
          const c = T.peer.connect((CFG.PEER_PREFIX || 'impostor-pl-gra-') + code, { reliable: true });
          T.conn = c;
          const to = setTimeout(() => { if (T.conn === c && !c.open) { setS('TV nie odpowiada…'); try { c.close(); } catch (e) {} T.conn = null; retryLater(); } }, 9000);
          c.on('open', () => { clearTimeout(to); if (T.conn !== c) return; setS(''); sync(); try { navigator.vibrate && navigator.vibrate(30); } catch (e) {} });
          c.on('data', m => { if (m && m.type === 'hello') sync(); if (m && m.type === 'err') { T.err = m.text; alert(m.text); } });
          c.on('close', () => { if (T.conn === c) { T.conn = null; setS(T.err ? 'TV w innej grze/trybie – ponawiam…' : 'rozłączono, ponawiam…'); T.err = ''; retryLater(); } });
          c.on('error', () => {});
        };
        if (T.peer && !T.peer.destroyed && T.peer.open) return go();
        if (T.peer) { try { T.peer.destroy(); } catch (e) {} }
        const p = T.peer = new Peer();
        p.on('open', go);
        p.on('error', e => {
          if (T.peer !== p) return;
          setS(e.type === 'peer-unavailable' ? 'nie widzę TV o kodzie ' + T.code : 'błąd połączenia (' + e.type + ')');
          if (e.type !== 'peer-unavailable') { try { p.destroy(); } catch (x) {} T.peer = null; }
          T.conn = null; retryLater();
        });
        p.on('disconnected', () => { try { if (!p.destroyed) p.reconnect(); } catch (e) {} });
      }).catch(() => { setS('brak internetu'); retryLater(); });
    }
    function disconnect() { clearTimeout(T.retry); T.code = ''; if (T.conn) { try { T.conn.close(); } catch (e) {} T.conn = null; } setS(''); }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && T.code && !open()) connect(T.code); });
    const q = normCode(new URLSearchParams(location.search).get('tv'));
    if (q) { setTimeout(() => connect(q), 0); history.replaceState(null, '', location.pathname); }
    return { sync, connect, disconnect, get code() { return T.code; }, get connected() { return open(); } };
  },
};
})();
