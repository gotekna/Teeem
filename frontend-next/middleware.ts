import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * URL Migration Middleware
 *
 * Redirects old query-param URLs to new path-based URLs.
 * This ensures backward compatibility with bookmarks and shared links.
 *
 * Example redirects:
 * - /admin/system?tab=company&subtab=info → /admin/system/company/info
 * - /contacts/123?tab=overview → /contacts/123/overview
 * - /financial?company=456 → /financial/company/456
 */

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Skip if no query params (already using new format)
  if (searchParams.toString() === "") {
    return NextResponse.next();
  }

  // Skip OAuth callbacks - these MUST keep query params
  if (pathname.startsWith("/xero/callback") ||
      pathname.includes("/oauth") ||
      pathname.includes("/callback")) {
    return NextResponse.next();
  }

  // Skip API routes
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Build redirect URL based on pattern
  let redirectPath: string | null = null;

  // === Admin System Routes ===
  if (pathname === "/admin/system") {
    const tab = searchParams.get("tab");
    const subtab = searchParams.get("subtab");
    const view = searchParams.get("view");
    const table = searchParams.get("table");
    const inner = searchParams.get("inner");
    const scope = searchParams.get("scope");

    if (tab) {
      let path = `/admin/system/${tab}`;

      if (subtab) {
        path += `/${subtab}`;

        // Schedule Master has view/table as third level
        if (view) {
          path += `/${view}`;
        } else if (table) {
          path += `/${table}`;
        }
      }

      // Handle inner param for document templates
      if (inner) {
        path += `/inner/${inner}`;
      }

      // Handle scope param
      if (scope) {
        path += `/scope/${scope}`;
      }

      redirectPath = path;
    }
  }

  // === Settings Routes ===
  if (pathname === "/settings") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/settings/${tab}`;
    }
  }

  // === Financial Routes ===
  if (pathname === "/financial") {
    const subtab = searchParams.get("subtab");
    const company = searchParams.get("company");

    let path = "/financial";
    if (subtab) {
      path += `/${subtab}`;
    }
    if (company) {
      path += `/company/${company}`;
    }

    if (subtab || company) {
      redirectPath = path;
    }
  }

  // === Contact Detail Routes ===
  const contactMatch = pathname.match(/^\/contacts\/(\d+)$/);
  if (contactMatch) {
    const tab = searchParams.get("tab");
    const subtab = searchParams.get("subtab");
    const edit = searchParams.get("edit");

    if (edit === "true") {
      redirectPath = `${pathname}/edit`;
    } else if (tab) {
      let path = `${pathname}/${tab}`;
      if (subtab) {
        path += `/${subtab}`;
      }
      redirectPath = path;
    }
  }

  // === Job Detail Routes ===
  const jobMatch = pathname.match(/^\/jobs\/(\d+)$/);
  if (jobMatch) {
    const tab = searchParams.get("tab");
    const edit = searchParams.get("edit");

    if (edit === "true") {
      redirectPath = `${pathname}/edit`;
    } else if (tab) {
      redirectPath = `${pathname}/${tab}`;
    }
  }

  // === Corporate Company Routes ===
  const companyMatch = pathname.match(/^\/corporate\/companies\/(\d+)$/);
  if (companyMatch) {
    const tab = searchParams.get("tab");
    const subtab = searchParams.get("subtab");

    if (tab) {
      let path = `${pathname}/${tab}`;
      if (subtab) {
        path += `/${subtab}`;
      }
      redirectPath = path;
    }
  }

  // === Lead Detail Routes ===
  const leadMatch = pathname.match(/^\/leads\/(\d+)$/);
  if (leadMatch) {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `${pathname}/${tab}`;
    }
  }

  // === Contact List Filters ===
  if (pathname === "/contacts") {
    const filter = searchParams.get("filter");
    if (filter) {
      redirectPath = `/contacts/filter/${filter}`;
    }
  }

  // === Quality Review Filters ===
  if (pathname === "/contacts/quality-review") {
    const filter = searchParams.get("filter");
    if (filter) {
      redirectPath = `/contacts/quality-review/${filter}`;
    }
  }

  // === Data Warehouse Company Filter ===
  if (pathname === "/data-warehouse") {
    const companyId = searchParams.get("company_id");
    if (companyId) {
      redirectPath = `/data-warehouse/company/${companyId}`;
    }
  }

  // === Xero Routes ===
  if (pathname === "/xero" && !pathname.includes("callback")) {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/xero/${tab}`;
    }
  }

  // === Leads List ===
  if (pathname === "/leads" && !pathname.match(/\/leads\/\d+/)) {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/leads/tab/${tab}`;
    }
  }

  // === Documents ===
  if (pathname === "/documents") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/documents/${tab}`;
    }
  }

  // === Corporate ASIC ===
  if (pathname === "/corporate/asic-logins") {
    const groupId = searchParams.get("company_group_id");
    if (groupId) {
      redirectPath = `/corporate/asic-logins/group/${groupId}`;
    }
  }

  // === Job Creation with Status ===
  if (pathname === "/jobs/new") {
    const status = searchParams.get("status");
    if (status) {
      redirectPath = `/jobs/new/status/${status.toLowerCase()}`;
    }
  }

  // Perform redirect if we have a new path
  if (redirectPath) {
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    url.search = ""; // Clear query params
    return NextResponse.redirect(url, { status: 301 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and API routes
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
