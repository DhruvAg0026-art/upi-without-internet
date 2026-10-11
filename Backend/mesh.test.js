import test from 'node:test';
import assert from 'node:assert/strict';
import { MeshSimulator } from './mesh.js';

test('gossip forwards a packet once to each device and bridge can collect it', () => {
  const mesh = new MeshSimulator();
  const packet = { packetId: 'packet-12345678', ttl: 5, createdAt: Date.now(), ciphertext: 'opaque' };
  mesh.inject('phone-alice', packet);

  const round = mesh.gossipOnce();
  const bridgeUploads = mesh.collectBridgeUploads();

  assert.equal(round.transfers, 4);
  assert.equal(bridgeUploads.length, 1);
  assert.equal(bridgeUploads[0].bridgeNodeId, 'phone-bridge');
  assert.equal(bridgeUploads[0].packet.ttl, 4);
});

test('reset clears packets while retaining the seeded device network', () => {
  const mesh = new MeshSimulator();
  mesh.inject('phone-alice', { packetId: 'packet-1', ttl: 1 });
  mesh.reset();

  const state = mesh.getState(0);
  assert.equal(state.devices.length, 5);
  assert.equal(state.devices.reduce((sum, device) => sum + device.packetCount, 0), 0);
});