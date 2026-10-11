import mongoose from 'mongoose';
import { Account, Transaction } from './models.js';

export async function settlePayment(instruction, packetHash, bridgeNodeId, hopCount) {
  const { senderVpa, receiverVpa, amountPaise, signedAt } = instruction;
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw new Error('Invalid payment amount.');
  }

  const session = await mongoose.startSession();
  let savedTransaction;
  try {
    await session.withTransaction(async () => {
      const sender = await Account.findOne({ vpa: senderVpa }).session(session);
      const receiver = await Account.findOne({ vpa: receiverVpa }).session(session);
      if (!sender) throw new Error(`Unknown sender VPA: ${senderVpa}`);
      if (!receiver) throw new Error(`Unknown receiver VPA: ${receiverVpa}`);

      const status = sender.balancePaise < amountPaise ? 'REJECTED' : 'SETTLED';
      if (status === 'SETTLED') {
        await Account.updateOne(
          { vpa: senderVpa, balancePaise: { $gte: amountPaise } },
          { $inc: { balancePaise: -amountPaise } },
          { session }
        );
        await Account.updateOne(
          { vpa: receiverVpa },
          { $inc: { balancePaise: amountPaise } },
          { session }
        );
      }

      [savedTransaction] = await Transaction.create([{
        packetHash,
        senderVpa,
        receiverVpa,
        amountPaise,
        signedAt: new Date(signedAt),
        settledAt: new Date(),
        bridgeNodeId,
        hopCount,
        status
      }], { session });
    });
    return savedTransaction;
  } finally {
    await session.endSession();
  }
}