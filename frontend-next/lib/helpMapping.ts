// Page-to-Chapter Mapping for Contextual Help
// Maps Next.js routes to User Manual chapter numbers
// SSoT: page-help.json contains detailed help content for each page

import pageHelpData from './page-help.json';

export interface HelpInfo {
  chapter: number;
  section: string;
}

export interface PageHelp {
  title: string;
  description: string;
  tips: string[];
  tasks: string[];
}

// Get detailed help content for a page from page-help.json
export function getPageHelp(pathname: string): PageHelp | null {
  const pages = pageHelpData.pages as Record<string, PageHelp>;

  // Try exact match first
  if (pages[pathname]) {
    return pages[pathname];
  }

  // Try pattern match for dynamic routes (e.g., /jobs/123 → /jobs/[id])
  const pathParts = pathname.split('/').filter(Boolean);

  // Check for dynamic route patterns
  for (const pattern of Object.keys(pages)) {
    if (pattern.includes('[')) {
      // Convert pattern like /jobs/[id] to regex
      const regexPattern = pattern
        .replace(/\[.*?\]/g, '[^/]+')
        .replace(/\//g, '\\/');
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(pathname)) {
        return pages[pattern];
      }
    }
  }

  // Try progressively shorter paths (e.g., /settings/system/navigation → /settings/system → /settings)
  for (let i = pathParts.length; i > 0; i--) {
    const partialPath = '/' + pathParts.slice(0, i).join('/');
    if (pages[partialPath]) {
      return pages[partialPath];
    }
  }

  return null;
}

export const PAGE_HELP_MAPPING: Record<string, HelpInfo> = {
  // Getting Started (Chapter 0)
  '/dashboard': { chapter: 0, section: 'dashboard' },

  // Authentication & Users (Chapter 1)
  '/login': { chapter: 1, section: 'login' },
  '/signup': { chapter: 1, section: 'signup' },
  '/profile': { chapter: 1, section: 'profile' },
  '/users': { chapter: 1, section: 'users' },

  // System Administration (Chapter 2)
  '/settings': { chapter: 2, section: 'overview' },
  '/admin/system': { chapter: 2, section: 'system' },
  '/settings/company': { chapter: 2, section: 'company' },
  '/settings/users': { chapter: 2, section: 'users' },

  // Contacts & Relationships (Chapter 3)
  '/contacts': { chapter: 3, section: 'overview' },
  '/contacts/new': { chapter: 3, section: 'creating' },
  '/leads': { chapter: 3, section: 'leads' },
  '/cases': { chapter: 3, section: 'cases' },

  // Price Books & Suppliers (Chapter 4)
  '/settings/pricebooks': { chapter: 4, section: 'overview' },
  '/settings/pricebooks/import': { chapter: 4, section: 'import' },
  '/settings/suppliers': { chapter: 4, section: 'suppliers' },

  // Jobs & Construction Management (Chapter 5)
  '/jobs': { chapter: 5, section: 'overview' },
  '/jobs/new': { chapter: 5, section: 'creating' },

  // Estimates & Quoting (Chapter 6)
  '/estimates': { chapter: 6, section: 'overview' },

  // AI Plan Review (Chapter 7)
  '/ai-review': { chapter: 7, section: 'overview' },

  // Purchase Orders (Chapter 8)
  '/purchase_orders': { chapter: 8, section: 'overview' },

  // Gantt & Schedule Master (Chapter 9)
  '/gantt': { chapter: 9, section: 'overview' },
  '/schedule': { chapter: 9, section: 'master' },

  // Project Tasks & Checklists (Chapter 10)
  '/tasks': { chapter: 10, section: 'overview' },

  // Weather & Public Holidays (Chapter 11)
  '/weather': { chapter: 11, section: 'overview' },
  '/calendar': { chapter: 11, section: 'calendar' },

  // OneDrive Integration (Chapter 12)
  '/files': { chapter: 12, section: 'overview' },
  '/settings/onedrive': { chapter: 12, section: 'setup' },

  // Outlook/Email Integration (Chapter 13)
  '/email': { chapter: 13, section: 'overview' },
  '/email/rules': { chapter: 13, section: 'rules' },
  '/email/settings': { chapter: 13, section: 'settings' },
  '/settings/outlook': { chapter: 13, section: 'setup' },

  // Chat & Communications (Chapter 14)
  '/chat': { chapter: 14, section: 'overview' },
  '/meetings': { chapter: 14, section: 'meetings' },

  // Xero Accounting Integration (Chapter 15)
  '/xero': { chapter: 15, section: 'overview' },
  '/settings/xero': { chapter: 15, section: 'setup' },

  // Payments & Financials (Chapter 16)
  '/payments': { chapter: 16, section: 'overview' },
  '/finance': { chapter: 16, section: 'finance' },

  // Workflows & Automation (Chapter 17)
  '/settings/workflows': { chapter: 17, section: 'overview' },

  // Custom Tables & Formulas (Chapter 18)
  '/custom-tables': { chapter: 18, section: 'overview' },
  '/settings/custom-tables': { chapter: 18, section: 'setup' },

  // Corporate Module (Chapter 19) - Basic corporate pages
  '/corporate': { chapter: 19, section: 'overview' },
  '/corporate/health-report': { chapter: 19, section: 'health-report' },
  '/assets': { chapter: 19, section: 'assets' },

  // Corporate Module Extended (Chapter 20)
  '/corporate/directors': { chapter: 20, section: 'directors' },
  '/corporate/shareholders': { chapter: 20, section: 'shareholders' },
  '/corporate/beneficiaries': { chapter: 20, section: 'beneficiaries' },
  '/corporate/compliance-calendar': { chapter: 20, section: 'compliance' },
  '/corporate/asic-logins': { chapter: 20, section: 'asic' },
  '/corporate/minute-templates': { chapter: 20, section: 'minutes' },
  '/settings/corporate': { chapter: 20, section: 'settings' },

  // Work Health & Safety (Chapter 21)
  '/whs': { chapter: 21, section: 'overview' },
  '/whs/incidents': { chapter: 21, section: 'incidents' },
  '/whs/inspections': { chapter: 21, section: 'inspections' },
  '/whs/inductions': { chapter: 21, section: 'inductions' },
  '/whs/swms': { chapter: 21, section: 'swms' },
  '/whs/action-items': { chapter: 21, section: 'action-items' },

  // Customer Portal (Chapter 22)
  '/portal': { chapter: 22, section: 'overview' },
  '/portal/access': { chapter: 22, section: 'access' },
  '/portal/quotes': { chapter: 22, section: 'quotes' },
  '/portal/invoices': { chapter: 22, section: 'invoices' },
  '/portal/payments': { chapter: 22, section: 'payments' },
  '/portal/messages': { chapter: 22, section: 'messages' },

  // File Warehouse (Chapter 23)
  '/warehouse': { chapter: 23, section: 'overview' },
  '/warehouse/folders': { chapter: 23, section: 'folders' },
  '/warehouse/documents': { chapter: 23, section: 'documents' },
  '/settings/connections': { chapter: 23, section: 'storage' },

  // E-Signatures (Chapter 24)
  '/signatures': { chapter: 24, section: 'overview' },
  '/signatures/send': { chapter: 24, section: 'send' },
  '/signatures/pending': { chapter: 24, section: 'pending' },
  '/signatures/completed': { chapter: 24, section: 'completed' },

  // Data Warehouse & Reports (Chapter 25)
  '/reports': { chapter: 25, section: 'overview' },
  '/reports/builder': { chapter: 25, section: 'builder' },
  '/reports/scheduled': { chapter: 25, section: 'scheduled' },
  '/data-warehouse': { chapter: 25, section: 'data-warehouse' },

  // Documentation Page
  '/documentation': { chapter: 0, section: 'overview' },
};

/**
 * Get help chapter for current page
 */
export function getHelpForPage(pathname: string): HelpInfo {
  // Try exact match first
  if (PAGE_HELP_MAPPING[pathname]) {
    return PAGE_HELP_MAPPING[pathname];
  }

  // Try pattern match for dynamic routes (e.g., /jobs/123 matches /jobs/[id])
  // Check if pathname starts with any known prefix
  const pathParts = pathname.split('/').filter(Boolean);

  // Try progressively shorter paths
  for (let i = pathParts.length; i > 0; i--) {
    const partialPath = '/' + pathParts.slice(0, i).join('/');
    if (PAGE_HELP_MAPPING[partialPath]) {
      return PAGE_HELP_MAPPING[partialPath];
    }
  }

  // Default to overview if no match
  return { chapter: 0, section: 'overview' };
}

/**
 * Get chapter name from chapter number
 */
export function getChapterName(chapterNumber: number): string {
  const chapterNames: Record<number, string> = {
    0: 'Overview',
    1: 'Authentication & Users',
    2: 'System Administration',
    3: 'Contacts & Relationships',
    4: 'Price Books & Suppliers',
    5: 'Jobs & Construction Management',
    6: 'Estimates & Quoting',
    7: 'AI Plan Review',
    8: 'Purchase Orders',
    9: 'Gantt & Schedule Master',
    10: 'Project Tasks & Checklists',
    11: 'Weather & Public Holidays',
    12: 'OneDrive Integration',
    13: 'Outlook/Email Integration',
    14: 'Chat & Communications',
    15: 'Xero Accounting Integration',
    16: 'Payments & Financials',
    17: 'Workflows & Automation',
    18: 'Custom Tables & Formulas',
    19: 'Corporate Module',
    20: 'Corporate Module Extended',
    21: 'Work Health & Safety',
    22: 'Customer Portal',
    23: 'File Warehouse',
    24: 'E-Signatures',
    25: 'Data Warehouse & Reports',
  };

  return chapterNames[chapterNumber] || 'Help';
}
