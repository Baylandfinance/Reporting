import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM for Microsoft Graph refresh tokens at rest. Supabase already
 * encrypts the underlying disk, but a refresh token is effectively a
 * long-lived credential into the firm's whole M365 tenant — it gets a
 * second, application-level layer so a database dump or a leaked
 * service-role key alone isn't enough to reuse it.
 */
function getKey(): Buffer {
  const b64 = process.env.GRAPH_TOKEN_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error(
      "GRAPH_TOKEN_ENCRYPTION_KEY is not set — generate one with `openssl rand -base64 32`"
    );
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("GRAPH_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

export function encryptToken(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptToken({
  encrypted,
  iv,
  authTag,
}: {
  encrypted: string;
  iv: string;
  authTag: string;
}) {
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
