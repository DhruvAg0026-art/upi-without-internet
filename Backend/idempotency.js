import { PacketClaim } from './models.js';

const TTL_SECONDS = Number(process.env.IDEMPOTENCY_TTL_SECONDS ?? 86400);

export async function claimPacket(packetHash) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_SECONDS * 1000);
  const expiredClaim = await PacketClaim.findOneAndUpdate(
    { packetHash, expiresAt: { $lte: now } },
    { $set: { expiresAt } },
    { new: true }
  );
  if (expiredClaim) return true;

  try {
    await PacketClaim.create({ packetHash, expiresAt });
    return true;
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
}

export async function clearClaims() {
  await PacketClaim.deleteMany({});
}

export function getClaimCount() {
  return PacketClaim.countDocuments();
}