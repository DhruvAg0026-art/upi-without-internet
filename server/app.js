import cors from 'cors';
import express from 'express';
import { randomUUID, createHash } from 'node:crypto';
import { Account, Transaction } from './models.js';
import { encryptInstruction, publicKeyBase64 } from './crypto.js';
import { parseAmountToPaise, paiseToRupees } from './amount.js';
import { clearClaims, getClaimCount } from './idempotency.js';
import { ingestPacket } from './ingestion.js';

function accountDto(account) {
  return {
    vpa: account.vpa,
    holderName: account.holderName,
    balance: paiseToRupees(account.balancePaise)
  };
}

function transactionDto(transaction) {
  return {
    id: String(transaction._id),
    packetHash: transaction.packetHash,
    senderVpa: transaction.senderVpa,
    receiverVpa: transaction.receiverVpa,
    amount: paiseToRupees(transaction.amountPaise),
    signedAt: transaction.signedAt,
    settledAt: transaction.settledAt,
    bridgeNodeId: transaction.bridgeNodeId,
    hopCount: transaction.hopCount,
    status: transaction.status
  };
}

export function createApp({ keys, mesh }) {
  const app = express();
  app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));

  app.get('/api/server-key', (_request, response) => response.json({
    publicKey: publicKeyBase64(keys.publicKey),
    algorithm: 'RSA-2048 / OAEP-SHA256',
    hybridScheme: 'RSA-OAEP encrypts an AES-256-GCM session key'
  }));

  app.post('/api/demo/send', (request, response) => {
    try {
      const { senderVpa, receiverVpa, pin, ttl = 5, startDevice = 'phone-alice' } = request.body;
      if (!senderVpa || !receiverVpa || typeof pin !== 'string' || pin.length < 4 || pin.length > 8) {
        return response.status(400).json({ error: 'Sender, receiver, and a 4-8 character PIN are required.' });
      }
      if (!Number.isInteger(ttl) || ttl < 0 || ttl > 20) {
        return response.status(400).json({ error: 'TTL must be an integer between 0 and 20.' });
      }

      const amountPaise = parseAmountToPaise(request.body.amount);
      const instruction = {
        senderVpa,
        receiverVpa,
        amountPaise,
        pinHash: createHash('sha256').update(pin, 'utf8').digest('hex'),
        nonce: randomUUID(),
        signedAt: Date.now()
      };
      const packet = {
        packetId: randomUUID(),
        ttl,
        createdAt: Date.now(),
        ciphertext: encryptInstruction(instruction, keys.publicKey)
      };
      mesh.inject(startDevice, packet);
      return response.json({
        packetId: packet.packetId,
        ciphertextPreview: `${packet.ciphertext.slice(0, 64)}...`,
        ttl: packet.ttl,
        injectedAt: startDevice
      });
    } catch (error) {
      return response.status(400).json({ error: error.message });
    }
  });

  app.get('/api/mesh/state', async (_request, response, next) => {
    try {
      response.json(mesh.getState(await getClaimCount()));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/mesh/gossip', (_request, response) => response.json(mesh.gossipOnce()));

  app.post('/api/mesh/flush', async (_request, response, next) => {
    try {
      const uploads = mesh.collectBridgeUploads();
      const results = await Promise.all(uploads.map(async ({ bridgeNodeId, packet }) => {
        const result = await ingestPacket(packet, bridgeNodeId, 5 - packet.ttl, keys.privateKey);
        return {
          bridgeNode: bridgeNodeId,
          packetId: packet.packetId.slice(0, 8),
          ...result
        };
      }));
      response.json({ uploadsAttempted: uploads.length, results });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/mesh/reset', async (_request, response, next) => {
    try {
      mesh.reset();
      await clearClaims();
      response.json({ status: 'mesh and idempotency cache cleared' });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/bridge/ingest', async (request, response, next) => {
    try {
      const result = await ingestPacket(
        request.body,
        request.get('X-Bridge-Node-Id') ?? 'unknown',
        Number(request.get('X-Hop-Count') ?? 0),
        keys.privateKey
      );
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/accounts', async (_request, response, next) => {
    try {
      const accounts = await Account.find().sort({ vpa: 1 }).lean();
      response.json(accounts.map(accountDto));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/transactions', async (_request, response, next) => {
    try {
      const transactions = await Transaction.find().sort({ settledAt: -1 }).limit(20).lean();
      response.json(transactions.map(transactionDto));
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}