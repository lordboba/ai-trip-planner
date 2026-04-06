const ACCESS_COOKIE_NAME = "tripwise-access";
const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const ACCESS_CODE_ENV_KEYS = ["TRIPWISE_ACCESS_CODE", "APP_ACCESS_CODE"] as const;

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function getConfiguredAccessCode() {
  for (const key of ACCESS_CODE_ENV_KEYS) {
    const value = process.env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}

export function isAccessGateEnabled() {
  return Boolean(getConfiguredAccessCode());
}

export async function buildAccessCookieValue(accessCode: string) {
  const encoded = new TextEncoder().encode(`tripwise-access:${accessCode}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return toHex(digest);
}

export async function getExpectedAccessCookieValue() {
  const accessCode = getConfiguredAccessCode();

  if (!accessCode) {
    return null;
  }

  return buildAccessCookieValue(accessCode);
}

export async function hasValidAccessCookie(cookieValue?: string | null) {
  if (!isAccessGateEnabled()) {
    return true;
  }

  if (!cookieValue) {
    return false;
  }

  const expected = await getExpectedAccessCookieValue();
  return cookieValue === expected;
}

export {
  ACCESS_COOKIE_MAX_AGE,
  ACCESS_COOKIE_NAME,
};
