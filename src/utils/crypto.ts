import { config } from './config';

function deriveKey(key: string): Uint8Array {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(key);
  // Simple key derivation - pad/truncate to 32 bytes
  const derived = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    derived[i] = keyBytes[i % keyBytes.length]! ^ (i * 13 + 7);
  }
  return derived;
}

export function encrypt(plaintext: string): string {
  const key = deriveKey(config.encryptionKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // XOR-based encryption (simple but functional for local SQLite)
  const encrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i]! ^ key[i % key.length]! ^ iv[i % iv.length]!;
  }

  // Combine IV + encrypted data and base64 encode
  const combined = new Uint8Array(iv.length + encrypted.length);
  combined.set(iv);
  combined.set(encrypted, iv.length);

  return btoa(String.fromCharCode(...combined));
}

export function decrypt(ciphertext: string): string {
  const key = deriveKey(config.encryptionKey);
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i]! ^ key[i % key.length]! ^ iv[i % iv.length]!;
  }

  return new TextDecoder().decode(decrypted);
}
