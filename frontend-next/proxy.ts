import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = [
  '/login',
  '/auth/callback',
  '/portal/login',
];

// Routes that start with these paths are public
const publicPathPrefixes = [
  '/api/',
  '/_next/',
  '/favicon.ico',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if it's a public route
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Check if it's a public path prefix
  if (publicPathPrefixes.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Check for auth token in cookies or localStorage via custom header
  // Note: In Next.js middleware, we can't access localStorage directly
  // We rely on cookies for server-side auth checks
  const _token = request.cookies.get('token')?.value;

  // For now, let client-side handle auth
  // This middleware can be enhanced to check JWT validity
  // or redirect unauthenticated users

  // If no token and trying to access protected route, redirect to login
  // Commented out for now - let client-side AuthContext handle this
  // if (!token && !pathname.startsWith('/login')) {
  //   return NextResponse.redirect(new URL('/login', request.url));
  // }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
