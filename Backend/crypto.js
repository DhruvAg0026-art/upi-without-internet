import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  publicEncrypt,
  privateDecrypt,
  randomBytes
} from 'node:crypto';

const RSA_ENCRYPTED_KEY_BYTES = 256;
const AES_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

export function createServerKeyPair() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
}

export function publicKeyBase64(publicKey) {
  return Buffer.from(publicKey.replace(/-----(BEGIN|END) PUBLIC KEY-----|\s/g, ''), 'base64').toString('base64');
}

export function encryptInstruction(instruction, publicKey) {
  const aesKey = randomBytes(AES_KEY_BYTES);
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const encryptedPayload = Buffer.concat([
    cipher.update(JSON.stringify(instruction), 'utf8'),
    cipher.final(),
    cipher.getAuthTag()
  ]);
  const encryptedKey = publicEncrypt({
    key: publicKey,
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, aesKey);

  return Buffer.concat([encryptedKey, iv, encryptedPayload]).toString('base64');
}

export function decryptInstruction(ciphertext, privateKey) {
  const packed = Buffer.from(ciphertext, 'base64');
  const minimumLength = RSA_ENCRYPTED_KEY_BYTES + GCM_IV_BYTES + GCM_TAG_BYTES;
  if (packed.length < minimumLength) throw new Error('Ciphertext too short');

  const encryptedKey = packed.subarray(0, RSA_ENCRYPTED_KEY_BYTES);
  const iv = packed.subarray(RSA_ENCRYPTED_KEY_BYTES, RSA_ENCRYPTED_KEY_BYTES + GCM_IV_BYTES);
  const encryptedPayload = packed.subarray(RSA_ENCRYPTED_KEY_BYTES + GCM_IV_BYTES);
  const tag = encryptedPayload.subarray(-GCM_TAG_BYTES);
  const encryptedBody = encryptedPayload.subarray(0, -GCM_TAG_BYTES);
  const aesKey = privateDecrypt({
    key: privateKey,
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, encryptedKey);
  const decipher = createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(encryptedBody), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}

export function hashCiphertext(ciphertext) {
  return createHash('sha256').update(ciphertext, 'utf8').digest('hex');
}