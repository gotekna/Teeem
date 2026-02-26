/**
 * Tutorial Content (TEEEM Academy)
 *
 * SSoT for all tutorial chapter definitions.
 * Each chapter targets specific user roles and contains ordered steps.
 *
 * To add a new chapter:
 * 1. Add it to TUTORIAL_CHAPTERS array below
 * 2. Add screenshots to public/tutorials/<chapter-id>/
 * 3. That's it - the system auto-discovers and displays by role
 */

import {
  LayoutDashboard,
  DollarSign,
  FileSpreadsheet,
  HardHat,
  Users,
  Mail,
  FolderOpen,
  ClipboardCheck,
} from "lucide-react";
import type { TutorialChapter } from "./tutorial-types";
import { SYSTEM_ROLES } from "@/lib/constants/roles";

export const TUTORIAL_CHAPTERS: TutorialChapter[] = [
  // ─────────────────────────────────────────────
  // Universal (all roles)
  // ─────────────────────────────────────────────
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Learn the basics of navigating TEEEM and finding what you need.",
    icon: LayoutDashboard,
    roles: "all",
    estimatedMinutes: 3,
    steps: [
      {
        title: "Your Dashboard",
        description:
          "The Dashboard is your home base. It shows your AI briefing with tasks due today, overdue items, and emails needing follow-up. Each card is clickable to drill into details.",
        joshuaMessage: "G'day! Welcome to TEEEM. This is your dashboard — your command centre for the day!",
        joshuaEmotion: "wave",
        actionUrl: "/dashboard",
      },
      {
        title: "Sidebar Navigation",
        description:
          "The sidebar on the left is your main menu. It's organized by category: Jobs, Contacts, Email, Documents, and more. You can collapse sections you don't use often by clicking the arrow.",
        joshuaMessage: "The sidebar is your best mate. Everything you need is right here.",
        joshuaEmotion: "point",
      },
      {
        title: "Global Search",
        description:
          "Press Ctrl+K (or Cmd+K on Mac) to open Global Search. It searches across jobs, contacts, emails, and documents all at once. Start typing and results appear instantly.",
        joshuaMessage: "Can't find something? Search is your secret weapon. Give it a try!",
        joshuaEmotion: "point",
      },
      {
        title: "The Help Button",
        description:
          "See the ? button in the top-right corner? Click it on any page to get context-specific tips and guidance. It knows which page you're on and shows relevant help.",
        joshuaMessage: "If you ever get stuck, the help button has tips for every page. Legend!",
        joshuaEmotion: "celebrate",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // Email (all roles)
  // ─────────────────────────────────────────────
  {
    id: "email-basics",
    title: "Email in TEEEM",
    description: "Learn how email integration works — sync, link to jobs, and never lose track.",
    icon: Mail,
    roles: "all",
    estimatedMinutes: 4,
    steps: [
      {
        title: "Your Unified Inbox",
        description:
          "TEEEM syncs your email accounts into one unified inbox. All your work emails are here alongside your jobs and contacts — no switching between apps.",
        joshuaMessage: "All your emails in one spot. No more digging through Outlook!",
        joshuaEmotion: "wave",
        actionUrl: "/email",
      },
      {
        title: "Linking Emails to Jobs",
        description:
          "When you open an email, you can link it to a job. This creates a permanent record in the job's email trail. Your whole team can see the conversation history.",
        joshuaMessage: "Link emails to jobs so nothing falls through the cracks. Your team will thank you!",
        joshuaEmotion: "point",
      },
      {
        title: "Composing Emails",
        description:
          "Click the compose button to write an email. You can use templates, attach documents from the File Warehouse, and the AI writing assistant can help with spelling and tone.",
        joshuaMessage: "The AI writing assistant fixes your spelling without judging. Trust me, I've seen some shockers!",
        joshuaEmotion: "celebrate",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // Documents (all roles)
  // ─────────────────────────────────────────────
  {
    id: "documents-overview",
    title: "File Warehouse",
    description: "Your central document hub — store, organize, and find files across all jobs.",
    icon: FolderOpen,
    roles: "all",
    estimatedMinutes: 3,
    steps: [
      {
        title: "The File Warehouse",
        description:
          "The File Warehouse is your document storage system. Every job has its own folder structure, and documents are automatically organized by type. Upload once, access from anywhere.",
        joshuaMessage: "Think of it as your digital filing cabinet. Everything organized, nothing lost!",
        joshuaEmotion: "wave",
        actionUrl: "/documents",
      },
      {
        title: "Uploading Documents",
        description:
          "Drag and drop files onto any job's documents tab, or use the upload button. TEEEM automatically deduplicates — if you upload the same file twice, it only stores it once.",
        joshuaMessage: "Just drag and drop! TEEEM handles the rest. No duplicates, no mess.",
        joshuaEmotion: "point",
      },
      {
        title: "Finding Documents",
        description:
          "Use Global Search (Ctrl+K) to search across all documents. You can also browse by job, filter by document type, or use the library for corporate templates.",
        joshuaMessage: "Need a document? Search finds it in seconds. Beats rummaging through the ute!",
        joshuaEmotion: "celebrate",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // Estimator chapters
  // ─────────────────────────────────────────────
  {
    id: "estimator-pricebook",
    title: "Managing Pricebook Items",
    description: "Learn how to add pricebook items and link price histories for accurate estimates.",
    icon: DollarSign,
    roles: [SYSTEM_ROLES.ESTIMATOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.PRODUCT_OWNER],
    estimatedMinutes: 5,
    steps: [
      {
        title: "Navigate to the Pricebook",
        description:
          "Open the Pricebook from the sidebar under 'Pricebook'. This is your master list of all materials, labor rates, and services your company uses in estimates.",
        joshuaMessage: "The pricebook is where all your pricing lives. Keep it up to date and your estimates write themselves!",
        joshuaEmotion: "wave",
        actionUrl: "/pricebook",
      },
      {
        title: "Adding a Pricebook Item",
        description:
          "Click the + button in the table header to add a new item. Fill in the code, description, unit of measure, and current price. The code should be unique and descriptive (e.g., 'CONC-30MPA' for 30MPa concrete).",
        joshuaMessage: "Good codes make searching easy. Keep 'em short but descriptive!",
        joshuaEmotion: "point",
      },
      {
        title: "Linking Price Histories",
        description:
          "Click on a pricebook item to open its detail view. Under the 'Price History' tab, you can add supplier quotes with dates. This tracks price changes over time and helps you pick the best rate.",
        joshuaMessage: "Price histories are gold! You can see which supplier gave the best rate last time.",
        joshuaEmotion: "point",
      },
      {
        title: "Using Items in Estimates",
        description:
          "When creating an estimate, search for pricebook items by code or description. The current price auto-fills, and you just set the quantity. The estimate calculates totals automatically.",
        joshuaMessage: "Ripper! Now you can build estimates in minutes instead of hours.",
        joshuaEmotion: "celebrate",
      },
    ],
  },
  {
    id: "estimator-estimates",
    title: "Creating Estimates",
    description: "Walk through creating a professional estimate for a job from start to finish.",
    icon: FileSpreadsheet,
    roles: [SYSTEM_ROLES.ESTIMATOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.PRODUCT_OWNER],
    estimatedMinutes: 5,
    steps: [
      {
        title: "Open a Job",
        description:
          "Navigate to a job from the Jobs list or search for it. The job detail page shows everything about the project: contacts, schedule, documents, and estimates.",
        joshuaMessage: "Every estimate lives inside a job. Find your job first, then we'll build the estimate!",
        joshuaEmotion: "wave",
        actionUrl: "/jobs",
      },
      {
        title: "Create a New Estimate",
        description:
          "On the job page, go to the 'Estimates' tab and click 'New Estimate'. Give it a name (e.g., 'Rev A - Initial Quote') and set the estimate type.",
        joshuaMessage: "Name your estimates clearly. When the client asks for changes, you'll have Rev A, Rev B, etc.",
        joshuaEmotion: "point",
      },
      {
        title: "Add Line Items",
        description:
          "Add items from your pricebook or enter custom line items. Set quantities, adjust margins, and organize by sections (e.g., 'Foundations', 'Framing', 'Finishes').",
        joshuaMessage: "Pro tip: Use sections to break up the estimate. Makes it way easier to review!",
        joshuaEmotion: "point",
      },
      {
        title: "Review and Export",
        description:
          "Review the estimate summary with totals, margins, and tax. When you're happy, export as PDF to send to the client, or email it directly from TEEEM.",
        joshuaMessage: "Looking sharp! Export to PDF and you're ready to send. Good luck with the bid!",
        joshuaEmotion: "celebrate",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // Supervisor chapters
  // ─────────────────────────────────────────────
  {
    id: "supervisor-tasks",
    title: "Site Tasks & Schedule",
    description: "Manage your daily site tasks, update progress, and keep the schedule on track.",
    icon: HardHat,
    roles: [SYSTEM_ROLES.SUPERVISOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.PRODUCT_OWNER],
    estimatedMinutes: 4,
    steps: [
      {
        title: "Your Task Hub",
        description:
          "The Task Hub shows all tasks assigned to you across all jobs. Filter by job, priority, or due date. Overdue tasks appear in red at the top.",
        joshuaMessage: "Task Hub is your daily run sheet. Start here every morning!",
        joshuaEmotion: "wave",
        actionUrl: "/tasks",
      },
      {
        title: "Updating Task Status",
        description:
          "Click a task to open it. Update the status (Not Started, In Progress, Complete), add notes, and attach site photos. The office sees updates in real-time.",
        joshuaMessage: "Keep your tasks updated and the office won't ring you every five minutes!",
        joshuaEmotion: "point",
      },
      {
        title: "The Schedule Master",
        description:
          "The Schedule Master shows the Gantt chart for each job. You can see trade sequences, dependencies, and critical path. Drag tasks to reschedule if something changes on site.",
        joshuaMessage: "The Gantt chart is the big picture. If a trade runs late, you'll see the knock-on effect straight away.",
        joshuaEmotion: "point",
      },
      {
        title: "Supervisor Checklist",
        description:
          "Each job has a supervisor checklist with quality and safety items. Complete these as you walk the site. They're saved to the job record for compliance.",
        joshuaMessage: "Checklists keep everyone safe and the build quality top-notch. Don't skip 'em!",
        joshuaEmotion: "celebrate",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // Admin chapters
  // ─────────────────────────────────────────────
  {
    id: "admin-users",
    title: "Managing Users",
    description: "Add team members, assign roles, and control who sees what.",
    icon: Users,
    roles: [SYSTEM_ROLES.ADMIN],
    estimatedMinutes: 4,
    steps: [
      {
        title: "User Management",
        description:
          "Go to Settings > Users to see everyone in your organization. Each user has a role that determines what they can see and do in TEEEM.",
        joshuaMessage: "User management is where you control the team. Add new users and set their roles here.",
        joshuaEmotion: "wave",
        actionUrl: "/settings/users",
      },
      {
        title: "Adding a New User",
        description:
          "Click 'Add User' and enter their name, email, and role. Choose from roles like Admin, Estimator, Supervisor, or User. They'll receive a login invite by email.",
        joshuaMessage: "New starter? Get 'em set up in 30 seconds. They'll get a login email automatically!",
        joshuaEmotion: "point",
      },
      {
        title: "Roles & Permissions",
        description:
          "Admins see everything. Estimators get pricing tools. Supervisors get site tools. Users get basic access. You can assign multiple roles to one person if they wear many hats.",
        joshuaMessage: "Pick the right role and TEEEM shows them exactly what they need. No clutter!",
        joshuaEmotion: "point",
      },
      {
        title: "Access Control",
        description:
          "Under Settings > Access Control, you can fine-tune permissions per role. Control who can approve POs, edit schedules, or access financial data.",
        joshuaMessage: "Access Control is the fine print. Set it once and forget it — unless someone gets promoted!",
        joshuaEmotion: "celebrate",
        actionUrl: "/settings/roles",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // Purchase Orders (estimator/admin)
  // ─────────────────────────────────────────────
  {
    id: "purchase-orders",
    title: "Purchase Orders",
    description: "Create, approve, and track purchase orders tied to your jobs.",
    icon: ClipboardCheck,
    roles: [SYSTEM_ROLES.ESTIMATOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.PRODUCT_OWNER, SYSTEM_ROLES.SUPERVISOR],
    estimatedMinutes: 4,
    steps: [
      {
        title: "Purchase Orders Overview",
        description:
          "Purchase Orders (POs) track what you're ordering for each job. They link to suppliers in your contacts and items from your pricebook. Find them under 'Purchase Orders' in the sidebar.",
        joshuaMessage: "POs keep your spending organized. Every dollar tracked, every job accounted for!",
        joshuaEmotion: "wave",
        actionUrl: "/purchase-orders",
      },
      {
        title: "Creating a Purchase Order",
        description:
          "Click 'Add' to create a new PO. Select the job, supplier, and add line items from the pricebook. Set delivery dates and add any special instructions.",
        joshuaMessage: "Pro tip: Use pricebook items so pricing is consistent across all your POs!",
        joshuaEmotion: "point",
      },
      {
        title: "Approval Workflow",
        description:
          "POs above certain thresholds may need approval. The system tracks who approved, when, and keeps a full audit trail. Approved POs can be emailed directly to the supplier.",
        joshuaMessage: "Nothing gets ordered without proper approval. That's how we keep budgets under control!",
        joshuaEmotion: "point",
      },
      {
        title: "Matching to Invoices",
        description:
          "When a supplier invoice comes in, match it to the PO. TEEEM highlights discrepancies between what was ordered and what was invoiced. This prevents overcharging.",
        joshuaMessage: "Invoice matching catches mistakes before they cost you. Worth its weight in gold!",
        joshuaEmotion: "celebrate",
      },
    ],
  },
];

/**
 * Get chapters visible to a user based on their roles.
 * Returns universal ('all') chapters plus role-specific ones.
 */
export function getChaptersForRoles(roleNames: string[]): TutorialChapter[] {
  return TUTORIAL_CHAPTERS.filter((chapter) => {
    if (chapter.roles === "all") return true;
    return chapter.roles.some((role) => roleNames.includes(role));
  });
}
