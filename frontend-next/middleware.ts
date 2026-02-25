import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware that passes the request pathname to the root layout via a header.
 * This allows the layout (a Server Component) to conditionally skip heavy
 * providers for lightweight public pages like /sign.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
}

// Run on all routes
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)"],
};
