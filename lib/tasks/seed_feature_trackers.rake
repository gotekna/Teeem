namespace :trapid do
  namespace :features do
    desc "Seed feature trackers from TRAPID_FEATURES_LIST.md"
    task seed: :environment do
      puts "Seeding feature trackers..."

      features_data = [
        # Chapter 1: Project Management
        {
          chapter: "1. PROJECT MANAGEMENT",
          feature_name: "Job Management",
          detail_point_1: "Create, track, and manage construction jobs",
          detail_point_2: "Real-time job status updates and notifications",
          detail_point_3: "Comprehensive job costing and budget tracking",
          sort_order: 10
        },
        {
          chapter: "1. PROJECT MANAGEMENT",
          feature_name: "Estimate Management",
          detail_point_1: "Generate detailed project estimates",
          detail_point_2: "Template-based estimation for faster quoting",
          detail_point_3: "Convert estimates to jobs seamlessly",
          sort_order: 20
        },
        {
          chapter: "1. PROJECT MANAGEMENT",
          feature_name: "Purchase Order System",
          detail_point_1: "Digital PO creation and approval workflows",
          detail_point_2: "Track PO status and delivery",
          detail_point_3: "Integration with supplier portal",
          sort_order: 30
        },

        # Chapter 2: Scheduling & Task Management
        {
          chapter: "2. SCHEDULING & TASK MANAGEMENT",
          feature_name: "Schedule Master (Gantt Chart)",
          detail_point_1: "Visual drag-and-drop Gantt chart interface",
          detail_point_2: "Dependency management and critical path analysis",
          detail_point_3: "Real-time collaboration and updates",
          sort_order: 40
        },
        {
          chapter: "2. SCHEDULING & TASK MANAGEMENT",
          feature_name: "Schedule Templates",
          detail_point_1: "Pre-built templates for common project types",
          detail_point_2: "Customizable templates with task libraries",
          detail_point_3: "One-click template application to new projects",
          sort_order: 50
        },
        {
          chapter: "2. SCHEDULING & TASK MANAGEMENT",
          feature_name: "Task Automation",
          detail_point_1: "Automated task creation based on triggers",
          detail_point_2: "Smart reminders and notifications",
          detail_point_3: "Workflow automation for repetitive tasks",
          sort_order: 60
        },

        # Chapter 3: Financial Management
        {
          chapter: "3. FINANCIAL MANAGEMENT",
          feature_name: "Real-Time Financial Tracking",
          detail_point_1: "Live P&L tracking per job",
          detail_point_2: "Budget vs actual cost monitoring",
          detail_point_3: "Financial forecasting and reporting",
          sort_order: 70
        },
        {
          chapter: "3. FINANCIAL MANAGEMENT",
          feature_name: "Payment Management",
          detail_point_1: "Progress claims and invoicing",
          detail_point_2: "Payment tracking and reconciliation",
          detail_point_3: "Automated payment reminders",
          sort_order: 80
        },
        {
          chapter: "3. FINANCIAL MANAGEMENT",
          feature_name: "Pay Now - Early Payment System",
          detail_point_1: "Supplier early payment discount program",
          detail_point_2: "Automated discount calculations",
          detail_point_3: "Cashflow optimization tools",
          sort_order: 90
        },

        # Chapter 4: AI-Powered Intelligence
        {
          chapter: "4. AI-POWERED INTELLIGENCE",
          feature_name: "AI Plan Review (Industry First)",
          detail_point_1: "Automated building plan analysis",
          detail_point_2: "Material quantity takeoffs from plans",
          detail_point_3: "Intelligent suggestion for missing items",
          sort_order: 100
        },
        {
          chapter: "4. AI-POWERED INTELLIGENCE",
          feature_name: "Intelligent Matching",
          detail_point_1: "Smart material matching across suppliers",
          detail_point_2: "Price comparison and recommendations",
          detail_point_3: "Historical pricing analysis",
          sort_order: 110
        },
        {
          chapter: "4. AI-POWERED INTELLIGENCE",
          feature_name: "Real Impact Reporting",
          detail_point_1: "AI-generated insights and recommendations",
          detail_point_2: "Predictive analytics for project outcomes",
          detail_point_3: "Performance benchmarking",
          sort_order: 120
        },

        # Chapter 5: Supplier & Contact Management
        {
          chapter: "5. SUPPLIER & CONTACT MANAGEMENT",
          feature_name: "Contact Management",
          detail_point_1: "Centralized contact database",
          detail_point_2: "Contact history and interaction tracking",
          detail_point_3: "Custom contact roles and types",
          sort_order: 130
        },
        {
          chapter: "5. SUPPLIER & CONTACT MANAGEMENT",
          feature_name: "Supplier Portal",
          detail_point_1: "Dedicated portal for supplier collaboration",
          detail_point_2: "Quote submission and PO management",
          detail_point_3: "Document sharing and communication",
          sort_order: 140
        },
        {
          chapter: "5. SUPPLIER & CONTACT MANAGEMENT",
          feature_name: "Quote Request System",
          detail_point_1: "Send RFQs to multiple suppliers",
          detail_point_2: "Compare quotes side-by-side",
          detail_point_3: "Automated quote follow-ups",
          sort_order: 150
        },

        # Chapter 6: Price Book & Cost Intelligence
        {
          chapter: "6. PRICE BOOK & COST INTELLIGENCE",
          feature_name: "Smart Material Cost Library",
          detail_point_1: "Comprehensive material pricing database",
          detail_point_2: "Real-time price updates from suppliers",
          detail_point_3: "Historical price trend analysis",
          sort_order: 160
        },
        {
          chapter: "6. PRICE BOOK & COST INTELLIGENCE",
          feature_name: "Intelligent Matching",
          detail_point_1: "AI-powered material matching",
          detail_point_2: "Duplicate detection and merging",
          detail_point_3: "Alternative product suggestions",
          sort_order: 170
        },
        {
          chapter: "6. PRICE BOOK & COST INTELLIGENCE",
          feature_name: "Bulk Operations",
          detail_point_1: "Bulk import/export of pricing data",
          detail_point_2: "Mass update capabilities",
          detail_point_3: "Batch processing for large datasets",
          sort_order: 180
        },

        # Chapter 7: Integrations Ecosystem
        {
          chapter: "7. INTEGRATIONS ECOSYSTEM",
          feature_name: "Xero Accounting Integration",
          detail_point_1: "Two-way sync with Xero accounting",
          detail_point_2: "Automated invoice and bill creation",
          detail_point_3: "Real-time financial data synchronization",
          sort_order: 190
        },
        {
          chapter: "7. INTEGRATIONS ECOSYSTEM",
          feature_name: "Microsoft OneDrive Integration",
          detail_point_1: "Cloud document storage and management",
          detail_point_2: "Direct file uploads from OneDrive",
          detail_point_3: "Automatic document organization",
          sort_order: 200
        },
        {
          chapter: "7. INTEGRATIONS ECOSYSTEM",
          feature_name: "Microsoft Outlook Integration",
          detail_point_1: "Email integration for communications",
          detail_point_2: "Calendar sync for scheduling",
          detail_point_3: "Contact synchronization",
          sort_order: 210
        },
        {
          chapter: "7. INTEGRATIONS ECOSYSTEM",
          feature_name: "SMS/Twilio Integration",
          detail_point_1: "SMS notifications and alerts",
          detail_point_2: "Two-way SMS communication",
          detail_point_3: "Automated SMS reminders",
          sort_order: 220
        },
        {
          chapter: "7. INTEGRATIONS ECOSYSTEM",
          feature_name: "Weather API Integration",
          detail_point_1: "Real-time weather data for projects",
          detail_point_2: "Schedule impact analysis",
          detail_point_3: "Weather-based notifications",
          sort_order: 230
        },

        # Chapter 8: Workplace Health & Safety
        {
          chapter: "8. WORKPLACE HEALTH & SAFETY (WHS)",
          feature_name: "SWMS (Safe Work Method Statements)",
          detail_point_1: "Digital SWMS creation and management",
          detail_point_2: "Template library for common tasks",
          detail_point_3: "Approval workflows and sign-offs",
          sort_order: 240
        },
        {
          chapter: "8. WORKPLACE HEALTH & SAFETY (WHS)",
          feature_name: "Inspections",
          detail_point_1: "Digital inspection checklists",
          detail_point_2: "Photo documentation and annotations",
          detail_point_3: "Inspection reporting and analytics",
          sort_order: 250
        },
        {
          chapter: "8. WORKPLACE HEALTH & SAFETY (WHS)",
          feature_name: "Incidents & Near Misses",
          detail_point_1: "Incident reporting and tracking",
          detail_point_2: "Investigation management",
          detail_point_3: "Corrective action tracking",
          sort_order: 260
        },
        {
          chapter: "8. WORKPLACE HEALTH & SAFETY (WHS)",
          feature_name: "Inductions",
          detail_point_1: "Site induction management",
          detail_point_2: "Digital sign-in/sign-out",
          detail_point_3: "Compliance tracking",
          sort_order: 270
        },
        {
          chapter: "8. WORKPLACE HEALTH & SAFETY (WHS)",
          feature_name: "WHS Dashboard",
          detail_point_1: "Real-time safety metrics",
          detail_point_2: "Compliance reporting",
          detail_point_3: "Risk heat maps",
          sort_order: 280
        },

        # Chapter 9: Workflow Automation
        {
          chapter: "9. WORKFLOW AUTOMATION",
          feature_name: "Custom Workflow Designer",
          detail_point_1: "Visual workflow builder",
          detail_point_2: "Conditional logic and branching",
          detail_point_3: "Integration with all Trapid modules",
          sort_order: 290
        },
        {
          chapter: "9. WORKFLOW AUTOMATION",
          feature_name: "Workflow Features",
          detail_point_1: "Automated approvals and notifications",
          detail_point_2: "Task assignment automation",
          detail_point_3: "Data transformation and processing",
          sort_order: 300
        },

        # Chapter 10: Custom Data Management
        {
          chapter: "10. CUSTOM DATA MANAGEMENT",
          feature_name: "Table Builder (No-Code Database)",
          detail_point_1: "Create custom tables without coding",
          detail_point_2: "Flexible field types and validation",
          detail_point_3: "Relationship management between tables",
          sort_order: 310
        },
        {
          chapter: "10. CUSTOM DATA MANAGEMENT",
          feature_name: "TrapidTableView (Enterprise Table Component)",
          detail_point_1: "Advanced data grid with sorting and filtering",
          detail_point_2: "Column customization and persistence",
          detail_point_3: "Bulk operations and export",
          sort_order: 320
        },
        {
          chapter: "10. CUSTOM DATA MANAGEMENT",
          feature_name: "Saved Views & Advanced Filtering",
          detail_point_1: "Save custom view configurations",
          detail_point_2: "Complex multi-field filtering",
          detail_point_3: "Share views with team members",
          sort_order: 330
        },

        # Chapter 11: Documentation & Knowledge Management
        {
          chapter: "11. DOCUMENTATION & KNOWLEDGE MANAGEMENT",
          feature_name: "Trinity Documentation System",
          detail_point_1: "Bible (rules), Teacher (how-to), Lexicon (knowledge)",
          detail_point_2: "Searchable documentation database",
          detail_point_3: "Version control and history",
          sort_order: 340
        },
        {
          chapter: "11. DOCUMENTATION & KNOWLEDGE MANAGEMENT",
          feature_name: "User Manual",
          detail_point_1: "Comprehensive end-user documentation",
          detail_point_2: "Step-by-step guides and tutorials",
          detail_point_3: "Searchable help system",
          sort_order: 350
        },

        # Chapter 12: Corporate & Compliance
        {
          chapter: "12. CORPORATE & COMPLIANCE",
          feature_name: "Company Management",
          detail_point_1: "Multi-company support",
          detail_point_2: "Company settings and configuration",
          detail_point_3: "Inter-company transactions",
          sort_order: 360
        },
        {
          chapter: "12. CORPORATE & COMPLIANCE",
          feature_name: "Asset Management",
          detail_point_1: "Track company assets and equipment",
          detail_point_2: "Maintenance scheduling",
          detail_point_3: "Depreciation tracking",
          sort_order: 370
        },

        # Chapter 13: User Management & Security
        {
          chapter: "13. USER MANAGEMENT & SECURITY",
          feature_name: "Role-Based Access Control",
          detail_point_1: "Granular permission management",
          detail_point_2: "Custom role creation",
          detail_point_3: "User group management",
          sort_order: 380
        },
        {
          chapter: "13. USER MANAGEMENT & SECURITY",
          feature_name: "Enterprise-Grade Security",
          detail_point_1: "Multi-factor authentication",
          detail_point_2: "Audit logging and tracking",
          detail_point_3: "Data encryption at rest and in transit",
          sort_order: 390
        },

        # Chapter 14: Reporting & Analytics
        {
          chapter: "14. REPORTING & ANALYTICS",
          feature_name: "Operational Reports",
          detail_point_1: "Pre-built report templates",
          detail_point_2: "Custom report builder",
          detail_point_3: "Scheduled report delivery",
          sort_order: 400
        },
        {
          chapter: "14. REPORTING & ANALYTICS",
          feature_name: "Export Capabilities",
          detail_point_1: "Export to Excel, CSV, PDF",
          detail_point_2: "Bulk data export",
          detail_point_3: "API access for data extraction",
          sort_order: 410
        },

        # Chapter 15: Communication
        {
          chapter: "15. COMMUNICATION",
          feature_name: "Team Chat",
          detail_point_1: "Real-time team messaging",
          detail_point_2: "File sharing in conversations",
          detail_point_3: "Project-based chat rooms",
          sort_order: 420
        },
        {
          chapter: "15. COMMUNICATION",
          feature_name: "Notifications",
          detail_point_1: "Multi-channel notifications (email, SMS, in-app)",
          detail_point_2: "Customizable notification preferences",
          detail_point_3: "Notification history and tracking",
          sort_order: 430
        },

        # Chapter 16: Mobile & Accessibility
        {
          chapter: "16. MOBILE & ACCESSIBILITY",
          feature_name: "Mobile Support",
          detail_point_1: "Responsive design for all devices",
          detail_point_2: "Offline mode for field work",
          detail_point_3: "Mobile-optimized workflows",
          sort_order: 440
        },
        {
          chapter: "16. MOBILE & ACCESSIBILITY",
          feature_name: "Accessibility",
          detail_point_1: "WCAG 2.1 compliance",
          detail_point_2: "Keyboard navigation support",
          detail_point_3: "Screen reader compatibility",
          sort_order: 450
        }
      ]

      features_data.each do |feature_data|
        feature = FeatureTracker.find_or_initialize_by(
          chapter: feature_data[:chapter],
          feature_name: feature_data[:feature_name]
        )

        feature.update!(feature_data)
        puts "✓ #{feature.chapter} - #{feature.feature_name}"
      end

      puts "\n#{features_data.count} features seeded successfully!"
      puts "\nStats:"
      puts "- Total features: #{FeatureTracker.count}"
      puts "- Total chapters: #{FeatureTracker.chapters.count}"
    end

    desc "Reset all feature completion statuses"
    task reset: :environment do
      puts "Resetting all feature completion statuses..."
      FeatureTracker.update_all(
        system_complete: false,
        dev_checked: false,
        tester_checked: false,
        user_checked: false
      )
      puts "✓ All statuses reset!"
    end
  end
end
