import { decryptInstruction, hashCiphertext } from './crypto.js';
import { claimPacket } from './idempotency.js';
import { settlePayment } from './settlement.js';

const MAX_PACKET_AGE_SECONDS = Number(process.env.PACKET_MAX_AGE_SECONDS ?? 86400);

export async function ingestPacket(packet, bridgeNodeId, hopCount, privateKey) {
  try {
    if (typeof packet?.ciphertext !== 'string' || packet.ciphertext.length === 0) {
      return { outcome: 'INVALID', packetHash: '', reason: 'missing_ciphertext', transactionId: null };
    }

    const packetHash = hashCiphertext(packet.ciphertext);
    if (!await claimPacket(packetHash)) {
      return { outcome: 'DUPLICATE_DROPPED', packetHash, reason: null, transactionId: null };
    }

    let instruction;
    try {
      instruction = decryptInstruction(packet.ciphertext, privateKey);
    } catch {
      return { outcome: 'INVALID', packetHash, reason: 'decryption_failed', transactionId: null };
    }

    if (!Number.isFinite(instruction.signedAt)) {
      return { outcome: 'INVALID', packetHash, reason: 'invalid_timestamp', transactionId: null };
    }
    const ageSeconds = (Date.now() - instruction.signedAt) / 1000;
    if (ageSeconds > MAX_PACKET_AGE_SECONDS) {
      return { outcome: 'INVALID', packetHash, reason: 'stale_packet', transactionId: null };
    }
    if (ageSeconds < -300) {
      return { outcome: 'INVALID', packetHash, reason: 'future_dated', transactionId: null };
    }

    const transaction = await settlePayment(instruction, packetHash, bridgeNodeId, hopCount);
    return {
      outcome: transaction.status,
      packetHash,
      reason: transaction.status === 'REJECTED' ? 'insufficient_funds' : null,
      transactionId: transaction.id
    };
  } catch {
    return { outcome: 'INVALID', packetHash: '', reason: 'settlement_failed', transactionId: null };
  }
}