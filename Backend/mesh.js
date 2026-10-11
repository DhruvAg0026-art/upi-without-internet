const DEFAULT_DEVICES = [
  ['phone-alice', false],
  ['phone-stranger1', false],
  ['phone-stranger2', false],
  ['phone-stranger3', false],
  ['phone-bridge', true]
];

export class MeshSimulator {
  constructor() {
    this.reset();
  }

  reset() {
    this.devices = new Map(DEFAULT_DEVICES.map(([deviceId, hasInternet]) => [deviceId, {
      deviceId,
      hasInternet,
      packets: new Map()
    }]));
  }

  inject(deviceId, packet) {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error(`Unknown device: ${deviceId}`);
    device.packets.set(packet.packetId, packet);
  }

  gossipOnce() {
    const devices = [...this.devices.values()];
    const snapshot = new Map(devices.map(device => [device.deviceId, [...device.packets.values()]]));
    let transfers = 0;

    for (const source of devices) {
      for (const packet of snapshot.get(source.deviceId)) {
        if (packet.ttl <= 0) continue;
        for (const destination of devices) {
          if (destination === source || destination.packets.has(packet.packetId)) continue;
          destination.packets.set(packet.packetId, { ...packet, ttl: packet.ttl - 1 });
          transfers += 1;
        }
      }
    }

    return {
      transfers,
      deviceCounts: Object.fromEntries(devices.map(device => [device.deviceId, device.packets.size]))
    };
  }

  getState(idempotencyCacheSize) {
    return {
      devices: [...this.devices.values()].map(({ deviceId, hasInternet, packets }) => ({
        deviceId,
        hasInternet,
        packetCount: packets.size,
        packetIds: [...packets.keys()].map(packetId => packetId.slice(0, 8))
      })),
      idempotencyCacheSize
    };
  }

  collectBridgeUploads() {
    return [...this.devices.values()]
      .filter(device => device.hasInternet)
      .flatMap(device => [...device.packets.values()].map(packet => ({
        bridgeNodeId: device.deviceId,
        packet
      })));
  }
}