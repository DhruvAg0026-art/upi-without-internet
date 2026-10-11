import mongoose from 'mongoose';
import { Account, PacketClaim, Transaction } from './models.js';

const seedAccounts = [
  { vpa: 'alice@demo', holderName: 'Alice', balancePaise: 500000 },
  { vpa: 'bob@demo', holderName: 'Bob', balancePaise: 100000 },
  { vpa: 'carol@demo', holderName: 'Carol', balancePaise: 250000 },
  { vpa: 'dave@demo', holderName: 'Dave', balancePaise: 50000 }
];

export async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is required. See .env.example.');
  await mongoose.connect(uri);
  await Promise.all([Account.init(), PacketClaim.init(), Transaction.init()]);

  if (await Account.estimatedDocumentCount() === 0) {
    try {
      await Account.insertMany(seedAccounts, { ordered: false });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
}