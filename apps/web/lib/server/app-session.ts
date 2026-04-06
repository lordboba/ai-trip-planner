import { getExpectedAccessCookieValue, isAccessGateEnabled } from "../access-gate.ts";

const APP_SESSION_SECRET_ENV_KEYS = ["TRIPWISE_APP_SESSION_SECRET", "APP_SESSION_SECRET"] as const;
const APP_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type AppSessionPayload = {
  v: 1;
  exp: number;
  gate: string | null;
};

function base64UrlEncode(bytes: Uint8Array) {
  const binary = Array.from(bytes, (value) => String.fromCharCode(value)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeUtf8(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

function getAppSessionSecret() {
  for (const key of APP_SESSION_SECRET_ENV_KEYS) {
    const value = process.env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}

async function signPayload(payload: string) {
  const secret = getAppSessionSecret();

  if (!secret) {
    throw new Error("App session secret is not configured.");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }

  return diff === 0;
}

export function getAuthorizationBearerToken(authorizationHeader?: string | null) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function issueAppSessionToken() {
  const payload: AppSessionPayload = {
    v: 1,
    exp: Math.floor(Date.now() / 1000) + APP_SESSION_MAX_AGE_SECONDS,
    gate: await getExpectedAccessCookieValue(),
  };
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = base64UrlEncode(await signPayload(encodedPayload));

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export async function verifyAppSessionToken(token?: string | null) {
  if (!isAccessGateEnabled()) {
    return true;
  }

  if (!token || !getAppSessionSecret()) {
    return false;
  }

  const [encodedPayload, encodedSignature] = token.split(".");

  if (!encodedPayload || !encodedSignature) {
    return false;
  }

  try {
    const expectedSignature = await signPayload(encodedPayload);
    const actualSignature = base64UrlDecode(encodedSignature);

    if (!timingSafeEqual(actualSignature, expectedSignature)) {
      return false;
    }

    const payload = JSON.parse(decodeUtf8(base64UrlDecode(encodedPayload))) as AppSessionPayload;

    if (payload.v !== 1 || payload.exp <= Math.floor(Date.now() / 1000)) {
      return false;
    }

    return payload.gate === await getExpectedAccessCookieValue();
  } catch {
    return false;
  }
}
