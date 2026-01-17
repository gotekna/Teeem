import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Multi-tenant subdomain routing middleware
 *
 * Handles subdomain-based tenant identification for the TEEEM SaaS platform.
 * Each tenant has their own subdomain (e.g., pilgrim.teeem.com.au)
 *
 * The middleware:
 * 1. Extracts the subdomain from the hostname
 * 2. Sets the x-tenant-subdomain header for API routes
 * 3. Skips processing for main domain, special subdomains, and static assets
 */

// Special subdomains that should not be treated as tenant subdomains
const RESERVED_SUBDOMAINS = new Set([
  'www',
  'teeem',
  'staging',
  'beta',
  'api',
  'admin',
  'app',
  'localhost',
]);

// Paths that should skip tenant resolution
const SKIP_PATHS = [
  '/_next',
  '/api',
  '/favicon.ico',
  '/manifest.json',
  '/icons',
  '/images',
  '/fonts',
];

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // Skip for static assets and API routes
  if (SKIP_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Extract subdomain from hostname
  // Handles: pilgrim.teeem.com.au, pilgrim.localhost:3000, etc.
  const hostParts = hostname.split('.');
  let subdomain: string | null = null;

  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    // Local development: subdomain.localhost:3000
    // e.g., "pilgrim.localhost:3000" -> "pilgrim"
    if (hostParts.length >= 2 && !hostParts[0].includes('localhost')) {
      subdomain = hostParts[0];
    }
  } else if (hostParts.length >= 3) {
    // Production: subdomain.teeem.com.au
    // e.g., "pilgrim.teeem.com.au" -> "pilgrim"
    subdomain = hostParts[0];
  }

  // Skip for reserved subdomains or no subdomain
  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain.toLowerCase())) {
    return NextResponse.next();
  }

  // Set tenant subdomain header for downstream use
  const response = NextResponse.next();
  response.headers.set('x-tenant-subdomain', subdomain.toLowerCase());

  // Also set a cookie for client-side access (useful for API calls)
  response.cookies.set('tenant-subdomain', subdomain.toLowerCase(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|images|fonts).*)',
  ],
};
