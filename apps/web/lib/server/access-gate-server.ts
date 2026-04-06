import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, hasValidAccessCookie, isAccessGateEnabled } from "@/lib/access-gate";
import { getAuthorizationBearerToken, verifyAppSessionToken } from "./app-session";

async function hasServerAccess(request?: Request) {
  if (!isAccessGateEnabled()) {
    return true;
  }

  const bearerToken = getAuthorizationBearerToken(request?.headers.get("authorization"));

  if (await verifyAppSessionToken(bearerToken)) {
    return true;
  }

  const cookieStore = await cookies();
  return hasValidAccessCookie(cookieStore.get(ACCESS_COOKIE_NAME)?.value ?? null);
}

export async function requirePageAccess(nextPath: string) {
  if (await hasServerAccess()) {
    return;
  }

  const redirectParams = new URLSearchParams({ next: nextPath });
  redirect(`/?${redirectParams.toString()}`);
}

export async function requireApiAccess(request?: Request) {
  if (await hasServerAccess(request)) {
    return null;
  }

  return NextResponse.json({ error: "Access code required." }, { status: 401 });
}
