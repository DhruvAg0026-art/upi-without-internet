import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
  vpa: { type: String, required: true, unique: true, trim: true },
  holderName: { type: String, required: true },
  balancePaise: { type: Number, required: true, min: 0, validate: Number.isSafeInteger }
}, { timestamps: true });

const transactionSchema = new mongoose.Schema({
  packetHash: { type: String, required: true, unique: true, index: true },
  senderVpa: { type: String, required: true },
  receiverVpa: { type: String, required: true },
  amountPaise: { type: Number, required: true, min: 1 },
  signedAt: { type: Date, required: true },
  settledAt: { type: Date, required: true },
  bridgeNodeId: { type: String, required: true },
  hopCount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['SETTLED', 'REJECTED'], required: true }
}, { timestamps: true });

const packetClaimSchema = new mongoose.Schema({
  packetHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });

export const Account = mongoose.models.Account ?? mongoose.model('Account', accountSchema);
export const Transaction = mongoose.models.Transaction ?? mongoose.model('Transaction', transactionSchema);
export const PacketClaim = mongoose.models.PacketClaim ?? mongoose.model('PacketClaim', packetClaimSchema);