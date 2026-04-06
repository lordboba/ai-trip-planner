import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE_MAX_AGE,
  ACCESS_COOKIE_NAME,
  buildAccessCookieValue,
  getConfiguredAccessCode,
  isAccessGateEnabled,
} from "@/lib/access-gate";
import { issueAppSessionToken } from "@/lib/server/app-session";

export async function POST(request: Request) {
  if (!isAccessGateEnabled()) {
    return NextResponse.json({ ok: true, enabled: false });
  }

  const body = (await request.json().catch(() => null)) as {
    code?: string;
    issueSessionToken?: boolean;
  } | null;
  const submittedCode = body?.code?.trim();
  const configuredCode = getConfiguredAccessCode();

  if (!configuredCode || !submittedCode || submittedCode !== configuredCode) {
    return NextResponse.json({ error: "Invalid access code." }, { status: 401 });
  }

  if (body?.issueSessionToken) {
    const session = await issueAppSessionToken();

    return NextResponse.json({
      ok: true,
      enabled: true,
      sessionToken: session.token,
      expiresAt: session.expiresAt,
    });
  }

  const response = NextResponse.json({ ok: true, enabled: true });

  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: await buildAccessCookieValue(configuredCode),
    httpOnly: true,
    maxAge: ACCESS_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
