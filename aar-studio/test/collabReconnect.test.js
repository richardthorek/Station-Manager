import { test } from 'node:test';
import assert from 'node:assert/strict';

// collab.js caches its socket singleton at module scope, so each test below
// imports a fresh instance via a cache-busting query string to stay isolated.
// A fake `io()` factory (installed on globalThis before each import) short-
// circuits collab.js's loadIo(), which only touches `document` when no
// `globalThis.io` is present — so no DOM stub is needed here.

function makeFakeSocket() {
  const handlers = {};
  const emitted = [];
  return {
    emitted,
    on(event, cb) { handlers[event] = cb; },
    off(event) { delete handlers[event]; },
    emit(event, payload, ack) {
      emitted.push({ event, payload });
      ack?.({ ok: true });
    },
    // Test helper: simulate the transport reconnecting (Socket.io fires
    // 'connect' again after any automatic reconnect, same as the first time).
    simulateReconnect() { handlers.connect?.(); },
  };
}

test('hostSession re-announces the same room to the server on reconnect (AAR-7)', async () => {
  const fakeSocket = makeFakeSocket();
  globalThis.io = () => fakeSocket;
  try {
    const { hostSession } = await import(`../js/lib/collab.js?t=host-${Date.now()}`);

    await hostSession('WAMB-42', {});
    fakeSocket.emitted.length = 0; // clear the initial host call

    fakeSocket.simulateReconnect();

    assert.equal(fakeSocket.emitted.length, 1);
    assert.equal(fakeSocket.emitted[0].event, 'aar:host');
    assert.equal(fakeSocket.emitted[0].payload.code, 'WAMB-42');
  } finally {
    delete globalThis.io;
  }
});

test('joinSession re-announces with the same code and label on reconnect (AAR-7)', async () => {
  const fakeSocket = makeFakeSocket();
  globalThis.io = () => fakeSocket;
  try {
    const { joinSession } = await import(`../js/lib/collab.js?t=join-${Date.now()}`);

    await joinSession('WAMB-42', 'Pat');
    fakeSocket.emitted.length = 0;

    fakeSocket.simulateReconnect();

    assert.equal(fakeSocket.emitted.length, 1);
    assert.deepEqual(fakeSocket.emitted[0].payload, { code: 'WAMB-42', label: 'Pat' });
  } finally {
    delete globalThis.io;
  }
});
