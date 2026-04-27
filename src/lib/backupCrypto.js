/**
 * Backup encryption helpers — AES-GCM with a key derived from
 * (license_key + counselor_email) via PBKDF2.
 *
 * File format (binary, served as application/octet-stream):
 *
 *   magic    [7 bytes]  = "BCNBKP1"
 *   salt    [16 bytes]  = random per-file
 *   iv      [12 bytes]  = random per-file
 *   ciphertext [...]    = AES-GCM(JSON.stringify(payload))
 *
 * Decryption auto-detects:
 *   - Files starting with "BCNBKP1" are decrypted with the current key.
 *   - Files starting with "{" or "[" are treated as legacy plaintext JSON
 *     (backward-compat with backups taken before this change shipped).
 *
 * Why PBKDF2 of license_key + email:
 *   - The counselor's email is in the counselor record (tenant identity).
 *   - The license key is in localStorage and is required for the app to
 *     decrypt-on-restore. If she lets her license lapse and clears it, she
 *     can re-enter the same key and recover the backup. If a stranger steals
 *     the JSON without the license key + email pair, the file is opaque.
 *   - 210k iterations matches OWASP 2023 PBKDF2-SHA256 recommendation.
 *
 * Limitation: this is at-rest encryption with a key derived from material the
 * counselor knows. It is NOT zero-knowledge end-to-end; anyone with the
 * counselor's license key + email can decrypt. That is the right model here:
 * the threat is "laptop stolen / Downloads folder leaked", not "vendor turns
 * malicious." For district-mode this gets replaced with district SSO key.
 */

const MAGIC = new TextEncoder().encode('BCNBKP1');
const SALT_LEN = 16;
const IV_LEN = 12;
const KEY_ITERATIONS = 210_000;

function concatBytes(...arrays) {
  const total = arrays.reduce((s, a) => s + a.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a instanceof Uint8Array ? a : new Uint8Array(a), offset);
    offset += a.byteLength;
  }
  return out;
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function deriveKey(licenseKey, email, salt) {
  const seedText = `${(licenseKey || '').trim().toUpperCase()}|${(email || '').trim().toLowerCase()}`;
  const seedBytes = new TextEncoder().encode(seedText);
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw', seedBytes, 'PBKDF2', false, ['deriveKey'],
  );
  return globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KEY_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt the backup payload (a JS object) and return a Blob suitable for
 * download. The blob is a plain binary container, not JSON.
 */
export async function encryptBackup(payload, { licenseKey, email }) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Browser does not support SubtleCrypto. Upgrade to a modern browser.');
  }
  if (!licenseKey || !email) {
    throw new Error('Encryption requires a license key and counselor email. Set up your license in Settings first.');
  }
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(licenseKey, email, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const cipherBytes = new Uint8Array(cipher);
  const blobBytes = concatBytes(MAGIC, salt, iv, cipherBytes);
  return new Blob([blobBytes], { type: 'application/octet-stream' });
}

/**
 * Detect whether the given Uint8Array / ArrayBuffer / string is a Beacon
 * encrypted backup. Returns 'encrypted' | 'plaintext' | 'unknown'.
 */
export function detectBackupKind(data) {
  if (typeof data === 'string') {
    const trimmed = data.trimStart();
    if (trimmed.startsWith('BCNBKP1')) return 'encrypted';
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'plaintext';
    return 'unknown';
  }
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length >= MAGIC.length && bytesEqual(bytes.slice(0, MAGIC.length), MAGIC)) {
    return 'encrypted';
  }
  // Best-effort: inspect first non-whitespace byte
  for (let i = 0; i < Math.min(8, bytes.length); i++) {
    const b = bytes[i];
    if (b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d) continue;
    if (b === 0x7b /* { */ || b === 0x5b /* [ */) return 'plaintext';
    return 'unknown';
  }
  return 'unknown';
}

/**
 * Decrypt a backup file. Accepts either an ArrayBuffer/Uint8Array (binary
 * encrypted) or a plain JSON string (legacy backups taken before this
 * change shipped). Returns the decoded payload object either way.
 */
export async function decryptBackup(data, { licenseKey, email }) {
  // String path = legacy plaintext JSON
  if (typeof data === 'string') {
    return JSON.parse(data);
  }
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length < MAGIC.length + SALT_LEN + IV_LEN) {
    throw new Error('Backup file is too short to be valid.');
  }
  const head = bytes.slice(0, MAGIC.length);
  if (!bytesEqual(head, MAGIC)) {
    // Not encrypted — try to parse as JSON. Useful when a counselor restores
    // a pre-encryption-era plaintext .json that they renamed or selected by
    // mistake.
    try { return JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new Error('Backup file format not recognized. Confirm you selected the right file.'); }
  }
  if (!licenseKey || !email) {
    throw new Error('This backup is encrypted. Enter your license key in Settings before restoring.');
  }
  const salt = bytes.slice(MAGIC.length, MAGIC.length + SALT_LEN);
  const iv = bytes.slice(MAGIC.length + SALT_LEN, MAGIC.length + SALT_LEN + IV_LEN);
  const cipher = bytes.slice(MAGIC.length + SALT_LEN + IV_LEN);
  const key = await deriveKey(licenseKey, email, salt);
  let plain;
  try {
    plain = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  } catch {
    throw new Error('Could not decrypt this backup. Verify the license key matches the one used when the backup was created.');
  }
  return JSON.parse(new TextDecoder().decode(plain));
}
