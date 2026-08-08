const DEVICE_IDENTITY_STORAGE_KEY = "rivonclaw-panel-device-identity-v1";

type StoredDeviceIdentity = {
  version: 1;
  deviceId: string;
  publicKey: string;
  privateKey: JsonWebKey;
  createdAtMs: number;
};

export type GatewayDeviceIdentity = {
  deviceId: string;
  publicKey: string;
  sign: (payload: string) => Promise<string>;
};

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fingerprintPublicKey(publicKey: Uint8Array): Promise<string> {
  const digestInput = Uint8Array.from(publicKey).buffer;
  const digest = await crypto.subtle.digest("SHA-256", digestInput);
  return bytesToHex(new Uint8Array(digest));
}

async function hydrateIdentity(stored: StoredDeviceIdentity): Promise<GatewayDeviceIdentity> {
  const publicKeyBytes = base64UrlDecode(stored.publicKey);
  const derivedDeviceId = await fingerprintPublicKey(publicKeyBytes);
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    stored.privateKey,
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  return {
    deviceId: derivedDeviceId,
    publicKey: stored.publicKey,
    sign: async (payload) => {
      const signature = await crypto.subtle.sign(
        { name: "Ed25519" },
        privateKey,
        new TextEncoder().encode(payload),
      );
      return base64UrlEncode(new Uint8Array(signature));
    },
  };
}

async function generateIdentity(): Promise<{
  identity: GatewayDeviceIdentity;
  stored: StoredDeviceIdentity;
}> {
  const keyPair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const publicKeyBytes = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
  const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicKey = base64UrlEncode(publicKeyBytes);
  const deviceId = await fingerprintPublicKey(publicKeyBytes);
  const stored: StoredDeviceIdentity = {
    version: 1,
    deviceId,
    publicKey,
    privateKey,
    createdAtMs: Date.now(),
  };
  return { identity: await hydrateIdentity(stored), stored };
}

export async function loadOrCreateGatewayDeviceIdentity(): Promise<GatewayDeviceIdentity> {
  if (!crypto?.subtle) {
    throw new Error("Gateway device authentication requires a secure browser context");
  }

  try {
    const raw = localStorage.getItem(DEVICE_IDENTITY_STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as StoredDeviceIdentity;
      if (
        stored.version === 1 &&
        typeof stored.deviceId === "string" &&
        typeof stored.publicKey === "string" &&
        stored.privateKey &&
        typeof stored.privateKey === "object"
      ) {
        const identity = await hydrateIdentity(stored);
        if (identity.deviceId !== stored.deviceId) {
          localStorage.setItem(
            DEVICE_IDENTITY_STORAGE_KEY,
            JSON.stringify({ ...stored, deviceId: identity.deviceId }),
          );
        }
        return identity;
      }
    }
  } catch {
    // Invalid or obsolete identities are replaced below.
  }

  const generated = await generateIdentity();
  localStorage.setItem(DEVICE_IDENTITY_STORAGE_KEY, JSON.stringify(generated.stored));
  return generated.identity;
}

function normalizeDeviceMetadata(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

export function buildGatewayDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string;
  nonce: string;
  platform?: string;
  deviceFamily?: string;
}): string {
  return [
    "v3",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAtMs),
    params.token ?? "",
    params.nonce,
    normalizeDeviceMetadata(params.platform),
    normalizeDeviceMetadata(params.deviceFamily),
  ].join("|");
}
