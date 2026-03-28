import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '../env.js';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const key = env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    return Buffer.from('0'.repeat(64), 'hex');
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const [ivHex, authTagHex, encrypted] = parts as [string, string, string];
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** Mask an API key for display: show first 7 + last 4 chars */
export function maskApiKey(key: string): string {
  if (key.length <= 12) return key.slice(0, 3) + '...' + key.slice(-3);
  return key.slice(0, 7) + '...' + key.slice(-4);
}
