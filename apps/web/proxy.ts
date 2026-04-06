import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  hasValidAccessCookie,
  isAccessGateEnabled,
} from "@/lib/access-gate";
import { getAuthorizationBearerToken, verifyAppSessionToken } from "@/lib/server/app-session";

function isPublicPath(pathname: string) {
  if (pathname === "/") {
    return true;
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/images")) {
    return true;
  }

  if (pathname === "/api/access/verify") {
    return true;
  }

  return false;
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

export async function proxy(request: NextRequest) {
  if (!isAccessGateEnabled() || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const bearerToken = getAuthorizationBearerToken(request.headers.get("authorization"));

  if (await verifyAppSessionToken(bearerToken)) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const hasAccess = await hasValidAccessCookie(cookieValue);

  if (hasAccess) {
    return NextResponse.next();
  }

  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json({ error: "Access code required." }, { status: 401 });
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/";
  redirectUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
