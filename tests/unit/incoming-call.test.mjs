import test from 'node:test';
import assert from 'node:assert/strict';
import { IncomingCall } from '../../src/systems/incoming-call.js';
import { createGameState } from '../../src/game/state.js';
import { MissionDirector } from '../../src/mission/director.js';

const makeCall = snapshot => new IncomingCall({ lineCount: 4, ringSeconds: 12, snapshot });

test('ring expires once; returning it from the phone reaches Eli and starts at line zero', () => {
  const call = makeCall();
  assert.equal(call.start().kind, 'ringing');
  assert.equal(call.tick(5).kind, 'ringing');
  assert.equal(call.remaining, 7);
  assert.equal(call.start().duplicate, true);
  assert.equal(call.remaining, 7);
  assert.equal(call.tick(7).kind, 'missed');
  assert.equal(call.status, 'missed');
  assert.equal(call.tick(100).changed, false);
  assert.equal(call.answer().reason, 'not-ringing');
  assert.deepEqual(
    { kind: call.returnFromPhone().kind, status: call.status, nextLine: call.nextLine },
    { kind: 'returned', status: 'active', nextLine: 0 },
  );
  assert.equal(call.returnFromPhone().duplicate, true);
});

test('answer, interruption, phone resume and replay preserve dialogue progress without duplicate contact', () => {
  const call = makeCall();
  call.start();
  const answered = call.answer();
  assert.equal(answered.firstContact, true);
  assert.equal(call.answer().firstContact, false);
  assert.equal(call.tick(99).changed, false);
  assert.equal(call.acknowledgeLine(0).nextLine, 1);
  assert.equal(call.acknowledgeLine(0).duplicate, true);
  assert.equal(call.acknowledgeLine(2).reason, 'out-of-order-line');
  assert.equal(call.interrupt().nextLine, 1);
  assert.equal(call.acknowledgeLine(1).reason, 'not-active');
  assert.equal(call.interrupt().duplicate, true);
  const resumed = call.returnFromPhone();
  assert.equal(resumed.kind, 'resumed');
  assert.equal(resumed.firstContact, false);
  assert.equal(resumed.nextLine, 1);
  for (let index = 1; index < 4; index++) assert.equal(call.acknowledgeLine(index).ok, true);
  assert.equal(call.complete().firstCompletion, true);
  assert.equal(call.complete().duplicate, true);
  const replay = call.returnFromPhone();
  assert.equal(replay.kind, 'replaying');
  assert.equal(replay.nextLine, 0);
  assert.equal(replay.firstContact, false);
  assert.equal(call.complete().firstCompletion, false);
});

test('declined call can be returned; any call outcome leaves the in-person job route available', () => {
  for (const outcome of ['ringing', 'missed', 'declined', 'interrupted']) {
    const call = makeCall();
    const state = createGameState({ runId: `call-${outcome}` });
    const director = new MissionDirector(state);
    call.start();
    if (outcome === 'missed') call.tick(12);
    if (outcome === 'declined') {
      assert.equal(call.decline().kind, 'declined');
      assert.equal(call.decline().duplicate, true);
      assert.equal(call.returnFromPhone().firstContact, true);
      call.interrupt();
    }
    if (outcome === 'interrupted') { call.answer(); call.interrupt(); }
    // The in-person event belongs to the director and has no phone guard.
    assert.equal(director.acceptJob().ok, true);
    assert.equal(state.mission.phase, 'COLLECTION');
    assert.equal(call.resolveInPerson().kind, 'superseded');
    assert.equal(call.tick(60).changed, false);
    assert.equal(call.resolveInPerson().duplicate, true);
    assert.equal(call.returnFromPhone().firstContact, false);
    assert.equal(state.mission.phase, 'COLLECTION');
  }
});

test('compact snapshots restore a running ring and an unfinished transcript exactly', () => {
  const ringing = makeCall(); ringing.start(); ringing.tick(3.5);
  const ringSnapshot = JSON.parse(JSON.stringify(ringing.snapshot()));
  assert.deepEqual(Object.keys(ringSnapshot), ['version', 'status', 'remaining', 'nextLine', 'contacted', 'completed']);
  const restoredRing = makeCall(ringSnapshot);
  assert.equal(restoredRing.remaining, 8.5);
  assert.equal(restoredRing.tick(8.5).kind, 'missed');

  const active = makeCall(); active.start(); active.answer(); active.acknowledgeLine(0); active.interrupt();
  const restored = makeCall(JSON.parse(JSON.stringify(active.snapshot())));
  assert.equal(restored.returnFromPhone().nextLine, 1);
  assert.equal(restored.acknowledgeLine(1).nextLine, 2);
  assert.equal(active.nextLine, 1);
  assert.throws(() => makeCall({ ...active.snapshot(), nextLine: 99 }), /Invalid incoming call snapshot/);
});

test('invalid durations and line acknowledgements cannot corrupt the call', () => {
  const call = makeCall(); call.start();
  assert.equal(call.tick(-1).reason, 'invalid-duration');
  assert.equal(call.tick(Number.POSITIVE_INFINITY).reason, 'invalid-duration');
  assert.equal(call.remaining, 12);
  call.answer();
  assert.equal(call.acknowledgeLine(-1).reason, 'invalid-line');
  assert.equal(call.acknowledgeLine(4).reason, 'invalid-line');
  assert.equal(call.nextLine, 0);
});
