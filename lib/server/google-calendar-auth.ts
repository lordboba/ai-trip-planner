import { cookies } from "next/headers";

const GOOGLE_OAUTH_STATE_COOKIE_NAME = "tripwise-google-oauth-state";
const GOOGLE_ACCESS_TOKEN_COOKIE_NAME = "tripwise-google-access-token";
const GOOGLE_REFRESH_TOKEN_COOKIE_NAME = "tripwise-google-refresh-token";

function getGoogleClientId() {
  return process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
}

function getGoogleClientSecret() {
  return process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "";
}

function getGoogleRedirectUri() {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ?? "";
}

function isGoogleOauthConfigured() {
  return Boolean(getGoogleClientId() && getGoogleClientSecret() && getGoogleRedirectUri());
}

function randomHex(bytes: number) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function createGoogleAuthorizeUrl() {
  if (!isGoogleOauthConfigured()) {
    throw new Error("Google OAuth is not configured.");
  }

  const state = randomHex(24);
  const cookieStore = await cookies();
  cookieStore.set({
    name: GOOGLE_OAUTH_STATE_COOKIE_NAME,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCodeForTokens(input: { code: string; state: string }) {
  if (!isGoogleOauthConfigured()) {
    throw new Error("Google OAuth is not configured.");
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE_NAME)?.value;

  if (!savedState || savedState !== input.state) {
    throw new Error("Invalid Google OAuth state.");
  }

  const body = new URLSearchParams({
    code: input.code,
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    redirect_uri: getGoogleRedirectUri(),
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google OAuth token exchange failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token || !payload.expires_in) {
    throw new Error("Google OAuth token response was missing required fields.");
  }

  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE_NAME);

  cookieStore.set({
    name: GOOGLE_ACCESS_TOKEN_COOKIE_NAME,
    value: payload.access_token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(60, payload.expires_in - 60),
  });

  if (payload.refresh_token) {
    cookieStore.set({
      name: GOOGLE_REFRESH_TOKEN_COOKIE_NAME,
      value: payload.refresh_token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

export async function getGoogleAccessTokenFromCookies() {
  const cookieStore = await cookies();
  return cookieStore.get(GOOGLE_ACCESS_TOKEN_COOKIE_NAME)?.value ?? null;
}
