import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * URL Migration Proxy
 *
 * Redirects old query-param URLs to new path-based URLs.
 * This ensures backward compatibility with bookmarks and shared links.
 *
 * Example redirects:
 * - /admin/system?tab=company&subtab=info → /admin/system/company/info
 * - /contacts/123?tab=overview → /contacts/123/overview
 * - /financial?company=456 → /financial/company/456
 */

export function proxy(request: NextRequest) {
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
  // Redirect old query params to path-based URLs:
  // - /jobs/123?tab=photo&subtab=site → /jobs/123/photo/site
  // - /jobs/123?edit=true → /jobs/123/edit
  const jobMatch = pathname.match(/^\/jobs\/(\d+)$/);
  if (jobMatch) {
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

  // === Corporate Asset Routes ===
  const assetMatch = pathname.match(/^\/corporate\/assets\/(\d+)$/);
  if (assetMatch) {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `${pathname}/${tab}`;
    }
  }

  // === Case Detail Routes ===
  const caseMatch = pathname.match(/^\/cases\/(\d+)$/);
  if (caseMatch) {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `${pathname}/${tab}`;
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

  // === Dashboard Routes ===
  if (pathname === "/dashboard") {
    const tab = searchParams.get("tab");
    if (tab && tab !== "overview") {
      redirectPath = `/dashboard/${tab}`;
    }
  }

  // === Documents ===
  if (pathname === "/documents") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/documents/${tab}`;
    }
  }

  // === Portal Routes ===
  if (pathname === "/portal") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/portal/${tab}`;
    }
  }

  // === Corporate Routes ===
  if (pathname === "/corporate") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/corporate/${tab}`;
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

  // === Meetings Routes ===
  if (pathname === "/meetings") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/meetings/${tab}`;
    }
  }

  // === Training Routes ===
  if (pathname === "/training") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/training/${tab}`;
    }
  }

  // === Workflows Routes ===
  if (pathname === "/workflows") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/workflows/${tab}`;
    }
  }

  // === Cases Routes ===
  if (pathname === "/cases") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/cases/${tab}`;
    }
  }

  // === System Health Routes ===
  if (pathname === "/system-health") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/system-health/${tab}`;
    }
  }

  // === Financial Transactions Routes ===
  if (pathname === "/financial/transactions") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/financial/transactions/${tab}`;
    }
  }

  // === Financial Reports Routes ===
  if (pathname === "/financial/reports") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/financial/reports/${tab}`;
    }
  }

  // === Financial TAS Routes ===
  if (pathname === "/financial/tas") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/financial/tas/${tab}`;
    }
  }

  // === Email Settings Routes ===
  if (pathname === "/email/settings") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/email/settings/${tab}`;
    }
  }

  // === Corporate Asset Reports Routes ===
  if (pathname === "/corporate/assets/reports") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/corporate/assets/reports/${tab}`;
    }
  }

  // === Schedule Master Routes ===
  if (pathname === "/schedule-master") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/schedule-master/${tab}`;
    }
  }

  // === Workflows Processes Routes ===
  if (pathname === "/workflows/processes") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/workflows/processes/${tab}`;
    }
  }

  // === Recipe Detail Routes ===
  const recipeMatch = pathname.match(/^\/recipes\/(\d+)$/);
  if (recipeMatch) {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `${pathname}/${tab}`;
    }
  }

  // === Job Analytics Routes ===
  const jobAnalyticsMatch = pathname.match(/^\/jobs\/(\d+)\/analytics$/);
  if (jobAnalyticsMatch) {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `${pathname}/${tab}`;
    }
  }

  // === Job Setup Routes ===
  const jobSetupMatch = pathname.match(/^\/jobs\/(\d+)\/setup$/);
  if (jobSetupMatch) {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `${pathname}/${tab}`;
    }
  }

  // === Job Resources Routes ===
  const jobResourcesMatch = pathname.match(/^\/jobs\/(\d+)\/resources$/);
  if (jobResourcesMatch) {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `${pathname}/${tab}`;
    }
  }

  // === Job Dashboard Routes ===
  const jobDashboardMatch = pathname.match(/^\/jobs\/(\d+)\/dashboard$/);
  if (jobDashboardMatch) {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `${pathname}/${tab}`;
    }
  }

  // === Job Field Routes ===
  const jobFieldMatch = pathname.match(/^\/jobs\/(\d+)\/field$/);
  if (jobFieldMatch) {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `${pathname}/${tab}`;
    }
  }

  // === Admin Site Presence Routes ===
  if (pathname === "/admin/site-presence") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/admin/site-presence/${tab}`;
    }
  }

  // === Admin SaaS Customer Detail Routes ===
  const saasCustomerMatch = pathname.match(/^\/admin\/saas-customers\/(\d+)$/);
  if (saasCustomerMatch) {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `${pathname}/${tab}`;
    }
  }

  // === Portal Jobs Routes ===
  if (pathname === "/portal/jobs") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/portal/jobs/${tab}`;
    }
  }

  // === Portal PayNow Routes ===
  if (pathname === "/portal/paynow") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/portal/paynow/${tab}`;
    }
  }

  // === Portal Quotes Routes ===
  if (pathname === "/portal/quotes") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/portal/quotes/${tab}`;
    }
  }

  // === Portal Invoices Routes ===
  if (pathname === "/portal/invoices") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/portal/invoices/${tab}`;
    }
  }

  // === Design System Routes ===
  if (pathname === "/design-system") {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `/design-system/${tab}`;
    }
  }

  // === Admin System Inner Tab Routes ===
  // GoldStandardTab (/admin/system/components?gold-tab=xxx)
  if (pathname === "/admin/system/components") {
    const goldTab = searchParams.get("gold-tab");
    if (goldTab) {
      redirectPath = `/admin/system/components/${goldTab}`;
    }
  }

  // DeveloperToolsTab (/admin/system/developer-tools?dev-tab=xxx)
  if (pathname === "/admin/system/developer-tools") {
    const devTab = searchParams.get("dev-tab");
    if (devTab) {
      redirectPath = `/admin/system/developer-tools/${devTab}`;
    }
  }

  // SecurityTab (/admin/system/company/security?securityTab=xxx)
  if (pathname === "/admin/system/company/security") {
    const securityTab = searchParams.get("securityTab");
    if (securityTab) {
      redirectPath = `/admin/system/company/security/${securityTab}`;
    }
  }

  // EntityConfigurationTab (/admin/system/entity-config?scope=xxx)
  if (pathname === "/admin/system/entity-config") {
    const scope = searchParams.get("scope");
    if (scope) {
      redirectPath = `/admin/system/entity-config/${scope}`;
    }
  }

  // === Dynamic Foundation Slug Routes ===
  // Catch-all for single-segment paths with ?tab= (e.g., /contacts?tab=schema → /contacts/schema)
  // Only match paths that are single segments and have a tab param
  const singleSegmentMatch = pathname.match(/^\/([a-z][a-z0-9_-]*)$/i);
  if (singleSegmentMatch && !redirectPath) {
    const tab = searchParams.get("tab");
    if (tab) {
      redirectPath = `${pathname}/${tab}`;
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
