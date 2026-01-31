// Tour Definitions for React Joyride
// SSoT for all page tours - each page has steps pointing to UI elements

import { Step } from "react-joyride";

export interface PageTour {
  id: string;
  title: string;
  steps: Step[];
}

// ============================================================================
// DASHBOARD TOUR
// ============================================================================
export const dashboardTour: PageTour = {
  id: "dashboard",
  title: "Dashboard Tour",
  steps: [
    {
      target: '[data-tour="metrics-cards"]',
      content: "These cards show your key metrics at a glance. Click any card to drill down into details.",
      title: "Quick Metrics",
      disableBeacon: true,
    },
    {
      target: '[data-tour="recent-items"]',
      content: "Recent activity from your team appears here - see what's been updated.",
      title: "Recent Activity",
      disableBeacon: true,
    },
    {
      target: '[data-tour="tasks-widget"]',
      content: "See your upcoming tasks and deadlines for this week.",
      title: "Upcoming Schedule",
      disableBeacon: true,
    },
  ],
};

// ============================================================================
// EMAIL TOUR
// ============================================================================
export const emailTour: PageTour = {
  id: "email",
  title: "Email Tour",
  steps: [
    {
      target: '[data-tour="email-accounts"]',
      content: "Your connected email accounts are listed here. Click to switch between mailboxes.",
      title: "Email Accounts",
      disableBeacon: true,
    },
    {
      target: '[data-tour="email-folders"]',
      content: "Navigate between Inbox, Drafts, Sent, and other folders.",
      title: "Email Folders",
      disableBeacon: true,
    },
    {
      target: '[data-tour="email-list"]',
      content: "Your emails appear here. Click any email to read it. Use keyboard shortcuts: J/K to navigate, R to reply.",
      title: "Email List",
      disableBeacon: true,
    },
    {
      target: '[data-tour="email-compose"]',
      content: "Click here to compose a new email. You can link emails to jobs and contacts.",
      title: "Compose Email",
      disableBeacon: true,
    },
    {
      target: '[data-tour="email-search"]',
      content: "Search across all your emails by subject, sender, body text, or attachments.",
      title: "Search Emails",
      disableBeacon: true,
    },
  ],
};

// ============================================================================
// JOBS TOUR
// ============================================================================
export const jobsTour: PageTour = {
  id: "jobs",
  title: "Jobs Tour",
  steps: [
    {
      target: '[data-tour="jobs-table"]',
      content: "All your jobs are listed here. Click any row to open the job details.",
      title: "Jobs List",
      disableBeacon: true,
    },
    {
      target: '[data-tour="jobs-filters"]',
      content: "Filter jobs by status, type, date range, or any column. Filters are saved automatically.",
      title: "Filter Jobs",
      disableBeacon: true,
    },
    {
      target: '[data-tour="jobs-add"]',
      content: "Click here to create a new job. You'll be guided through entering the job details.",
      title: "Create New Job",
      disableBeacon: true,
    },
    {
      target: '[data-tour="jobs-columns"]',
      content: "Customize which columns are visible. Drag to reorder, click headers to sort.",
      title: "Customize Columns",
      disableBeacon: true,
    },
  ],
};

// ============================================================================
// CONTACTS TOUR
// ============================================================================
export const contactsTour: PageTour = {
  id: "contacts",
  title: "Contacts Tour",
  steps: [
    {
      target: '[data-tour="contacts-table"]',
      content: "All your contacts (customers, suppliers, subcontractors) are listed here.",
      title: "Contacts List",
      disableBeacon: true,
    },
    {
      target: '[data-tour="contacts-filters"]',
      content: "Filter and search contacts by name, email, phone, company, or contact type.",
      title: "Filter & Search",
      disableBeacon: true,
    },
    {
      target: '[data-tour="contacts-add"]',
      content: "Click here to add a new contact. Link them to jobs, send emails, or create tasks.",
      title: "Add Contact",
      disableBeacon: true,
    },
    {
      target: '[data-tour="contacts-columns"]',
      content: "Customize which columns are visible. Drag to reorder, click headers to sort.",
      title: "Customize Columns",
      disableBeacon: true,
    },
  ],
};

// ============================================================================
// TASKS TOUR
// ============================================================================
export const tasksTour: PageTour = {
  id: "tasks",
  title: "Tasks Tour",
  steps: [
    {
      target: '[data-tour="tasks-list"]',
      content: "Your tasks are organized here. Check the box to mark complete.",
      title: "Task List",
      disableBeacon: true,
    },
    {
      target: '[data-tour="tasks-filters"]',
      content: "Filter by status (Open, Complete), assignee, due date, or linked job.",
      title: "Filter Tasks",
      disableBeacon: true,
    },
    {
      target: '[data-tour="tasks-add"]',
      content: "Create a new task. Assign it to team members and set due dates.",
      title: "Create Task",
      disableBeacon: true,
    },
    {
      target: '[data-tour="tasks-views"]',
      content: "Switch between List, Board (Kanban), and Calendar views.",
      title: "Task Views",
      disableBeacon: true,
    },
  ],
};

// ============================================================================
// CALENDAR TOUR
// ============================================================================
export const calendarTour: PageTour = {
  id: "calendar",
  title: "Calendar Tour",
  steps: [
    {
      target: '[data-tour="calendar-view"]',
      content: "Your schedule at a glance. Tasks, meetings, and job milestones appear here.",
      title: "Calendar View",
      disableBeacon: true,
    },
    {
      target: '[data-tour="calendar-nav"]',
      content: "Navigate between days, weeks, or months. Use arrows or click dates.",
      title: "Navigate Calendar",
      disableBeacon: true,
    },
    {
      target: '[data-tour="calendar-filters"]',
      content: "Show or hide different event types: Tasks, Meetings, Holidays.",
      title: "Filter Events",
      disableBeacon: true,
    },
    {
      target: '[data-tour="calendar-add"]',
      content: "Click any date to create a new event, or drag to create a time block.",
      title: "Add Events",
      disableBeacon: true,
    },
  ],
};

// ============================================================================
// WAREHOUSE TOUR
// ============================================================================
export const warehouseTour: PageTour = {
  id: "warehouse",
  title: "File Warehouse Tour",
  steps: [
    {
      target: '[data-tour="warehouse-folders"]',
      content: "Your files are organized into folders: Jobs, Contacts, Emails, and more.",
      title: "Folder Structure",
      disableBeacon: true,
    },
    {
      target: '[data-tour="warehouse-files"]',
      content: "Browse and preview files. Double-click to open, right-click for options.",
      title: "File List",
      disableBeacon: true,
    },
    {
      target: '[data-tour="warehouse-upload"]',
      content: "Drag files here or click to upload. Files are automatically organized.",
      title: "Upload Files",
      disableBeacon: true,
    },
    {
      target: '[data-tour="warehouse-search"]',
      content: "Search files by name, content, or metadata across all folders.",
      title: "Search Files",
      disableBeacon: true,
    },
  ],
};

// ============================================================================
// SETTINGS TOUR
// ============================================================================
export const settingsTour: PageTour = {
  id: "settings",
  title: "Settings Tour",
  steps: [
    {
      target: '[data-tour="settings-nav"]',
      content: "Settings are organized into categories. Click to navigate.",
      title: "Settings Navigation",
      disableBeacon: true,
    },
    {
      target: '[data-tour="settings-company"]',
      content: "Configure your company details, branding, and business settings.",
      title: "Company Settings",
      disableBeacon: true,
    },
    {
      target: '[data-tour="settings-users"]',
      content: "Manage team members, roles, and permissions.",
      title: "User Management",
      disableBeacon: true,
    },
    {
      target: '[data-tour="settings-integrations"]',
      content: "Connect to Xero, email providers, and storage services.",
      title: "Integrations",
      disableBeacon: true,
    },
  ],
};

// ============================================================================
// GANTT TOUR
// ============================================================================
export const ganttTour: PageTour = {
  id: "gantt",
  title: "Gantt Chart Tour",
  steps: [
    {
      target: '[data-tour="gantt-tasks"]',
      content: "The Gantt chart shows your project schedule. Tasks are listed on the left, timeline on the right.",
      title: "Gantt Chart",
      disableBeacon: true,
    },
    {
      target: '[data-tour="gantt-timeline"]',
      content: "Drag task bars to reschedule. Resize to change duration. Double-click to edit details.",
      title: "Timeline View",
      disableBeacon: true,
    },
    {
      target: '[data-tour="gantt-zoom"]',
      content: "Zoom in/out to see days, weeks, or months. Fit to screen with one click.",
      title: "Zoom Controls",
      disableBeacon: true,
    },
    {
      target: '[data-tour="gantt-dependencies"]',
      content: "Toggle to show task dependencies. Click to manage predecessor/successor relationships.",
      title: "Dependencies",
      disableBeacon: true,
    },
  ],
};

// ============================================================================
// JOB DETAIL TOUR
// ============================================================================
export const jobDetailTour: PageTour = {
  id: "job-detail",
  title: "Job Details Tour",
  steps: [
    {
      target: '[data-tour="job-header"]',
      content: "Job summary and status at a glance. Click to edit job details.",
      title: "Job Header",
      disableBeacon: true,
    },
    {
      target: '[data-tour="job-tabs"]',
      content: "Navigate between Overview, Documents, Emails, Schedule, and more.",
      title: "Job Tabs",
      disableBeacon: true,
    },
    {
      target: '[data-tour="job-documents"]',
      content: "All job documents are stored here. Upload, preview, and organize files.",
      title: "Documents",
      disableBeacon: true,
    },
    {
      target: '[data-tour="job-gantt"]',
      content: "View and manage the job schedule with the Gantt chart.",
      title: "Schedule",
      disableBeacon: true,
    },
  ],
};

// ============================================================================
// TOUR REGISTRY - Maps routes to tours
// ============================================================================
export const tourRegistry: Record<string, PageTour> = {
  "/dashboard": dashboardTour,
  "/email": emailTour,
  "/jobs": jobsTour,
  "/contacts": contactsTour,
  "/tasks": tasksTour,
  "/calendar": calendarTour,
  "/warehouse": warehouseTour,
  "/settings": settingsTour,
  "/gantt": ganttTour,
};

// Get tour for a specific route (handles dynamic routes)
export function getTourForRoute(pathname: string): PageTour | null {
  // Exact match first
  if (tourRegistry[pathname]) {
    return tourRegistry[pathname];
  }

  // Check for job detail page
  if (pathname.match(/^\/jobs\/\d+/)) {
    return jobDetailTour;
  }

  // Check for parent routes
  const parts = pathname.split("/").filter(Boolean);
  for (let i = parts.length; i > 0; i--) {
    const partial = "/" + parts.slice(0, i).join("/");
    if (tourRegistry[partial]) {
      return tourRegistry[partial];
    }
  }

  return null;
}

// Check if tour has been completed
export function isTourCompleted(tourId: string): boolean {
  if (typeof window === "undefined") return false;
  const completed = localStorage.getItem(`tour_completed_${tourId}`);
  return completed === "true";
}

// Mark tour as completed
export function markTourCompleted(tourId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`tour_completed_${tourId}`, "true");
}

// Reset tour (for "Take Tour Again")
export function resetTour(tourId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`tour_completed_${tourId}`);
}

// Reset all tours
export function resetAllTours(): void {
  if (typeof window === "undefined") return;
  Object.keys(tourRegistry).forEach((route) => {
    const tour = tourRegistry[route];
    localStorage.removeItem(`tour_completed_${tour.id}`);
  });
  localStorage.removeItem(`tour_completed_job-detail`);
}
