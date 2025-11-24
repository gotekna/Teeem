namespace :trapid do
  namespace :features do
    desc "Restructure features based on competitive analysis - creates new industry-standard feature set"
    task restructure: :environment do
      puts "🔄 Restructuring features based on competitive analysis..."
      puts "=" * 80

      # Backup old features first
      puts "\n📦 Backing up existing features..."
      old_features = FeatureTracker.all.map do |f|
        {
          chapter: f.chapter,
          feature_name: f.feature_name,
          dev_progress: f.dev_progress,
          system_complete: f.system_complete,
          trapid_has: f.trapid_has
        }
      end

      puts "   Backed up #{old_features.count} existing features"

      # Delete all existing features
      puts "\n🗑️  Clearing existing features..."
      FeatureTracker.destroy_all
      puts "   All features cleared"

      # Define new feature structure
      new_features = [
        # CHAPTER 1: Pre-Construction & Sales
        { chapter: "1. PRE-CONSTRUCTION & SALES", feature_name: "Lead Capture & CRM", detail_1: "Capture leads from web, phone, referrals", detail_2: "Track lead source and contact history", detail_3: "Lead scoring and prioritization", sort_order: 1 },
        { chapter: "1. PRE-CONSTRUCTION & SALES", feature_name: "Lead Nurturing & Email Marketing", detail_1: "Automated email campaigns", detail_2: "Marketing templates and branding", detail_3: "Track email opens and engagement", sort_order: 2 },
        { chapter: "1. PRE-CONSTRUCTION & SALES", feature_name: "Estimating & Takeoffs", detail_1: "Digital plan markup and measurement", detail_2: "Material quantity calculations", detail_3: "Labor time estimation", sort_order: 3 },
        { chapter: "1. PRE-CONSTRUCTION & SALES", feature_name: "Quote/Proposal Generation", detail_1: "Professional quote templates", detail_2: "Itemized pricing breakdown", detail_3: "Custom branding and terms", sort_order: 4 },
        { chapter: "1. PRE-CONSTRUCTION & SALES", feature_name: "Digital Signatures & Contracts", detail_1: "E-signature capture on any device", detail_2: "Contract templates library", detail_3: "Automated reminders for unsigned docs", sort_order: 5 },
        { chapter: "1. PRE-CONSTRUCTION & SALES", feature_name: "Tender Management", detail_1: "Track multiple tender submissions", detail_2: "Tender document repository", detail_3: "Deadline tracking and alerts", sort_order: 6 },
        { chapter: "1. PRE-CONSTRUCTION & SALES", feature_name: "Pre-Construction Workflow & Approvals", detail_1: "Permits and permissions tracking", detail_2: "Pre-start checklists", detail_3: "Required document verification", sort_order: 7 },

        # CHAPTER 2: Project Setup & Job Management
        { chapter: "2. PROJECT SETUP & JOB MANAGEMENT", feature_name: "Project/Job Creation", detail_1: "Quick job setup wizard", detail_2: "Client and site information", detail_3: "Job type and classification", sort_order: 1 },
        { chapter: "2. PROJECT SETUP & JOB MANAGEMENT", feature_name: "Project Templates", detail_1: "Reusable project templates", detail_2: "Standard task lists by job type", detail_3: "Template library management", sort_order: 2 },
        { chapter: "2. PROJECT SETUP & JOB MANAGEMENT", feature_name: "Budget Setup & Tracking", detail_1: "Initial budget allocation", detail_2: "Cost category breakdown", detail_3: "Budget vs actual comparison", sort_order: 3 },
        { chapter: "2. PROJECT SETUP & JOB MANAGEMENT", feature_name: "Job Status Management", detail_1: "Visual status indicators", detail_2: "Status change history", detail_3: "Automated status updates", sort_order: 4 },
        { chapter: "2. PROJECT SETUP & JOB MANAGEMENT", feature_name: "Change Orders / Variations", detail_1: "Change order creation and tracking", detail_2: "Client approval workflow", detail_3: "Auto-update to job costs", sort_order: 5 },
        { chapter: "2. PROJECT SETUP & JOB MANAGEMENT", feature_name: "Daily Logs / Site Diary", detail_1: "Daily site activity logging", detail_2: "Weather, workforce, progress notes", detail_3: "Photo attachments", sort_order: 6 },
        { chapter: "2. PROJECT SETUP & JOB MANAGEMENT", feature_name: "Job Costing", detail_1: "Real-time cost tracking", detail_2: "Labor and material costs", detail_3: "Profitability analysis", sort_order: 7 },

        # CHAPTER 3: Scheduling & Coordination
        { chapter: "3. SCHEDULING & COORDINATION", feature_name: "Gantt Chart Scheduling", detail_1: "Visual timeline view", detail_2: "Drag-and-drop task adjustment", detail_3: "Multi-project view", sort_order: 1 },
        { chapter: "3. SCHEDULING & COORDINATION", feature_name: "Critical Path Analysis", detail_1: "Automatic critical path calculation", detail_2: "Visual critical path highlighting", detail_3: "Impact analysis for delays", sort_order: 2 },
        { chapter: "3. SCHEDULING & COORDINATION", feature_name: "Schedule Templates", detail_1: "Reusable schedule templates", detail_2: "Task duration defaults", detail_3: "Quick schedule generation", sort_order: 3 },
        { chapter: "3. SCHEDULING & COORDINATION", feature_name: "Task Management & Dependencies", detail_1: "Task dependencies (predecessor/successor)", detail_2: "Auto-adjust dependent tasks", detail_3: "Task linking and relationships", sort_order: 4 },
        { chapter: "3. SCHEDULING & COORDINATION", feature_name: "Calendar Views", detail_1: "Day/week/month calendar views", detail_2: "Multiple project calendars", detail_3: "Filtered calendar by trade/resource", sort_order: 5 },
        { chapter: "3. SCHEDULING & COORDINATION", feature_name: "Trade Call-Ups & Notifications", detail_1: "Automated trade notifications", detail_2: "Email/SMS call-up alerts", detail_3: "Required on-site dates", sort_order: 6 },
        { chapter: "3. SCHEDULING & COORDINATION", feature_name: "Automatic Schedule Adjustments", detail_1: "Auto-shift following tasks on delays", detail_2: "Cascade updates through schedule", detail_3: "Conflict detection and alerts", sort_order: 7 },

        # CHAPTER 4: Financial Management
        { chapter: "4. FINANCIAL MANAGEMENT", feature_name: "Budgeting & Cost Tracking", detail_1: "Multi-level budget breakdowns", detail_2: "Cost code categories", detail_3: "Budget variance alerts", sort_order: 1 },
        { chapter: "4. FINANCIAL MANAGEMENT", feature_name: "Purchase Orders", detail_1: "PO creation and approval", detail_2: "Link POs to tasks and budgets", detail_3: "PO status tracking", sort_order: 2 },
        { chapter: "4. FINANCIAL MANAGEMENT", feature_name: "Invoicing & Progress Claims", detail_1: "Progressive invoicing", detail_2: "Automated invoice generation", detail_3: "Invoice status tracking", sort_order: 3 },
        { chapter: "4. FINANCIAL MANAGEMENT", feature_name: "Payment Processing", detail_1: "Multiple payment methods", detail_2: "Payment recording and receipts", detail_3: "Payment history", sort_order: 4 },
        { chapter: "4. FINANCIAL MANAGEMENT", feature_name: "Cashflow Forecasting", detail_1: "18-month cashflow projections", detail_2: "Income and expense predictions", detail_3: "Scenario planning", sort_order: 5 },
        { chapter: "4. FINANCIAL MANAGEMENT", feature_name: "Expense Tracking", detail_1: "Receipt capture and storage", detail_2: "Expense categorization", detail_3: "Reimbursement workflow", sort_order: 6 },
        { chapter: "4. FINANCIAL MANAGEMENT", feature_name: "Financial Reconciliation", detail_1: "Bank reconciliation", detail_2: "Invoice vs PO matching", detail_3: "Discrepancy alerts", sort_order: 7 },

        # CHAPTER 5: Accounting Integration
        { chapter: "5. ACCOUNTING INTEGRATION", feature_name: "Xero Integration", detail_1: "Two-way sync with Xero", detail_2: "Auto-create invoices in Xero", detail_3: "Chart of accounts mapping", sort_order: 1 },
        { chapter: "5. ACCOUNTING INTEGRATION", feature_name: "QuickBooks Integration", detail_1: "Two-way sync with QuickBooks", detail_2: "Auto-create invoices in QuickBooks", detail_3: "Customer and vendor sync", sort_order: 2 },
        { chapter: "5. ACCOUNTING INTEGRATION", feature_name: "MYOB Integration", detail_1: "Two-way sync with MYOB", detail_2: "Financial data synchronization", detail_3: "Eliminate double entry", sort_order: 3 },
        { chapter: "5. ACCOUNTING INTEGRATION", feature_name: "Auto Invoice Checking", detail_1: "Automatic invoice validation", detail_2: "Match invoices to POs", detail_3: "Flag discrepancies", sort_order: 4 },
        { chapter: "5. ACCOUNTING INTEGRATION", feature_name: "Real-Time Financial Sync", detail_1: "Live financial data updates", detail_2: "Instant financial visibility", detail_3: "Reduced reconciliation time", sort_order: 5 },
        { chapter: "5. ACCOUNTING INTEGRATION", feature_name: "Bank Reconciliation", detail_1: "Bank feed integration", detail_2: "Automatic transaction matching", detail_3: "Reconciliation reporting", sort_order: 6 },
        { chapter: "5. ACCOUNTING INTEGRATION", feature_name: "Payroll Integration (Australia)", detail_1: "Full Australian payroll system", detail_2: "Timesheets to payroll", detail_3: "Super and tax calculations", sort_order: 7 },

        # CHAPTER 6: Client Portal & Communication
        { chapter: "6. CLIENT PORTAL & COMMUNICATION", feature_name: "Client Portal Access", detail_1: "Secure client login", detail_2: "Personalized client dashboard", detail_3: "Mobile-responsive portal", sort_order: 1 },
        { chapter: "6. CLIENT PORTAL & COMMUNICATION", feature_name: "Project Progress Updates", detail_1: "Real-time progress tracking", detail_2: "Milestone notifications", detail_3: "Timeline visibility", sort_order: 2 },
        { chapter: "6. CLIENT PORTAL & COMMUNICATION", feature_name: "Selections Management", detail_1: "Client product selections", detail_2: "Selection deadlines and tracking", detail_3: "Option pricing comparison", sort_order: 3 },
        { chapter: "6. CLIENT PORTAL & COMMUNICATION", feature_name: "Document Sharing (Client View)", detail_1: "Shared document repository", detail_2: "Version history for clients", detail_3: "Download and print access", sort_order: 4 },
        { chapter: "6. CLIENT PORTAL & COMMUNICATION", feature_name: "Client Approvals", detail_1: "Digital approval workflow", detail_2: "Change order approvals", detail_3: "Approval history tracking", sort_order: 5 },
        { chapter: "6. CLIENT PORTAL & COMMUNICATION", feature_name: "Messaging & Notifications", detail_1: "In-app messaging", detail_2: "Email and SMS notifications", detail_3: "Message history", sort_order: 6 },
        { chapter: "6. CLIENT PORTAL & COMMUNICATION", feature_name: "Photo Galleries for Clients", detail_1: "Progress photo sharing", detail_2: "Before/after galleries", detail_3: "Client photo uploads", sort_order: 7 },

        # CHAPTER 7: Supplier & Subcontractor Management
        { chapter: "7. SUPPLIER & SUBCONTRACTOR MGMT", feature_name: "Supplier Database", detail_1: "Supplier contact information", detail_2: "Product/service categories", detail_3: "Supplier performance ratings", sort_order: 1 },
        { chapter: "7. SUPPLIER & SUBCONTRACTOR MGMT", feature_name: "Subcontractor Database", detail_1: "Trade contractor directory", detail_2: "Licenses and insurance tracking", detail_3: "Availability calendar", sort_order: 2 },
        { chapter: "7. SUPPLIER & SUBCONTRACTOR MGMT", feature_name: "Supplier Portal", detail_1: "Supplier secure login", detail_2: "PO visibility", detail_3: "Invoice submission", sort_order: 3 },
        { chapter: "7. SUPPLIER & SUBCONTRACTOR MGMT", feature_name: "Subcontractor Portal", detail_1: "Subcontractor secure login", detail_2: "Schedule and task visibility", detail_3: "Timesheet submission", sort_order: 4 },
        { chapter: "7. SUPPLIER & SUBCONTRACTOR MGMT", feature_name: "Quote Requests (RFQ)", detail_1: "Send RFQs to multiple suppliers", detail_2: "Quote comparison tools", detail_3: "Quote approval workflow", sort_order: 5 },
        { chapter: "7. SUPPLIER & SUBCONTRACTOR MGMT", feature_name: "Trade Scheduling & Call-Ups", detail_1: "Trade work scheduling", detail_2: "Automated call-up notifications", detail_3: "Electronic call-forward sheets", sort_order: 6 },
        { chapter: "7. SUPPLIER & SUBCONTRACTOR MGMT", feature_name: "Pricing Database & Assemblies", detail_1: "Custom price lists", detail_2: "Pre-built assemblies", detail_3: "Real-time price updates", sort_order: 7 },

        # CHAPTER 8: Document & File Management
        { chapter: "8. DOCUMENT & FILE MANAGEMENT", feature_name: "Cloud File Storage", detail_1: "Unlimited cloud storage", detail_2: "OneDrive integration", detail_3: "Folder organization", sort_order: 1 },
        { chapter: "8. DOCUMENT & FILE MANAGEMENT", feature_name: "Plan/Drawing Management", detail_1: "Plan versioning", detail_2: "Drawing markup tools", detail_3: "Plan comparison view", sort_order: 2 },
        { chapter: "8. DOCUMENT & FILE MANAGEMENT", feature_name: "Photo Management", detail_1: "Photo upload from any device", detail_2: "Auto-organize by project/date", detail_3: "Photo annotations", sort_order: 3 },
        { chapter: "8. DOCUMENT & FILE MANAGEMENT", feature_name: "Document Templates", detail_1: "Contract templates", detail_2: "Form templates", detail_3: "Custom template builder", sort_order: 4 },
        { chapter: "8. DOCUMENT & FILE MANAGEMENT", feature_name: "Version Control", detail_1: "Document version history", detail_2: "Rollback to previous versions", detail_3: "Version comparison", sort_order: 5 },
        { chapter: "8. DOCUMENT & FILE MANAGEMENT", feature_name: "Document Sharing & Permissions", detail_1: "Role-based access control", detail_2: "External sharing links", detail_3: "Permission management", sort_order: 6 },
        { chapter: "8. DOCUMENT & FILE MANAGEMENT", feature_name: "Electronic Filing System", detail_1: "Organized document structure", detail_2: "Search and filter", detail_3: "Tag-based organization", sort_order: 7 },

        # CHAPTER 9: Safety & Compliance
        { chapter: "9. SAFETY & COMPLIANCE", feature_name: "SWMS / JSA Management", detail_1: "Safe Work Method Statements", detail_2: "Job Safety Analysis library", detail_3: "Risk assessment tools", sort_order: 1 },
        { chapter: "9. SAFETY & COMPLIANCE", feature_name: "Site Inspections (Safety)", detail_1: "OH&S inspection checklists", detail_2: "Safety audit trails", detail_3: "Inspection scheduling", sort_order: 2 },
        { chapter: "9. SAFETY & COMPLIANCE", feature_name: "Incident & Near Miss Reporting", detail_1: "Incident logging", detail_2: "Investigation workflow", detail_3: "Corrective action tracking", sort_order: 3 },
        { chapter: "9. SAFETY & COMPLIANCE", feature_name: "Site Inductions", detail_1: "Worker induction management", detail_2: "Induction records", detail_3: "Compliance verification", sort_order: 4 },
        { chapter: "9. SAFETY & COMPLIANCE", feature_name: "Safety Dashboard & Alerts", detail_1: "Safety metrics overview", detail_2: "Compliance status", detail_3: "Automated safety alerts", sort_order: 5 },
        { chapter: "9. SAFETY & COMPLIANCE", feature_name: "OH&S Compliance Tracking", detail_1: "Regulatory compliance monitoring", detail_2: "License and certification tracking", detail_3: "Audit preparation", sort_order: 6 },
        { chapter: "9. SAFETY & COMPLIANCE", feature_name: "Risk Management", detail_1: "Risk register", detail_2: "Risk mitigation planning", detail_3: "Risk monitoring and review", sort_order: 7 },

        # CHAPTER 10: Quality & Site Management
        { chapter: "10. QUALITY & SITE MANAGEMENT", feature_name: "Quality Inspections (Trade)", detail_1: "Trade quality checklists", detail_2: "Pass/fail criteria", detail_3: "Remedial work tracking", sort_order: 1 },
        { chapter: "10. QUALITY & SITE MANAGEMENT", feature_name: "Quality Inspections (Supervisor)", detail_1: "Supervisor inspection forms", detail_2: "Quality standards verification", detail_3: "Inspection history", sort_order: 2 },
        { chapter: "10. QUALITY & SITE MANAGEMENT", feature_name: "Defects Management", detail_1: "Defect logging and tracking", detail_2: "Assign defects to trades", detail_3: "Defect resolution workflow", sort_order: 3 },
        { chapter: "10. QUALITY & SITE MANAGEMENT", feature_name: "Handover Checklists", detail_1: "Pre-handover inspection", detail_2: "Client walkthrough checklist", detail_3: "Handover documentation", sort_order: 4 },
        { chapter: "10. QUALITY & SITE MANAGEMENT", feature_name: "Warranty Management", detail_1: "Warranty period tracking", detail_2: "Warranty claim logging", detail_3: "Warranty work scheduling", sort_order: 5 },
        { chapter: "10. QUALITY & SITE MANAGEMENT", feature_name: "Practical Completion", detail_1: "PC certificate generation", detail_2: "Completion date tracking", detail_3: "PC documentation", sort_order: 6 },
        { chapter: "10. QUALITY & SITE MANAGEMENT", feature_name: "Final Signoffs", detail_1: "Client final approval", detail_2: "Authority approvals", detail_3: "Project closure workflow", sort_order: 7 },

        # CHAPTER 11: Reporting & Analytics
        { chapter: "11. REPORTING & ANALYTICS", feature_name: "Financial Reports", detail_1: "P&L by project", detail_2: "Budget vs actual", detail_3: "Cash position reports", sort_order: 1 },
        { chapter: "11. REPORTING & ANALYTICS", feature_name: "Project Dashboards", detail_1: "Real-time project metrics", detail_2: "Visual KPI indicators", detail_3: "Multi-project overview", sort_order: 2 },
        { chapter: "11. REPORTING & ANALYTICS", feature_name: "Custom Report Builder", detail_1: "Drag-and-drop report design", detail_2: "Custom field selection", detail_3: "Saved report templates", sort_order: 3 },
        { chapter: "11. REPORTING & ANALYTICS", feature_name: "Performance Metrics", detail_1: "Project performance tracking", detail_2: "Trade performance analytics", detail_3: "Benchmarking tools", sort_order: 4 },
        { chapter: "11. REPORTING & ANALYTICS", feature_name: "Profitability Analysis", detail_1: "Job profitability reporting", detail_2: "Margin analysis", detail_3: "Cost breakdown analysis", sort_order: 5 },
        { chapter: "11. REPORTING & ANALYTICS", feature_name: "Excel/PDF Export", detail_1: "Export to Excel", detail_2: "PDF generation", detail_3: "Scheduled report delivery", sort_order: 6 },
        { chapter: "11. REPORTING & ANALYTICS", feature_name: "One-Click Reports", detail_1: "Pre-configured reports", detail_2: "Instant report generation", detail_3: "Common report library", sort_order: 7 },

        # CHAPTER 12: Mobile & Field Operations
        { chapter: "12. MOBILE & FIELD OPERATIONS", feature_name: "Mobile App (iOS/Android)", detail_1: "Native mobile apps", detail_2: "Touch-optimized interface", detail_3: "Real-time sync", sort_order: 1 },
        { chapter: "12. MOBILE & FIELD OPERATIONS", feature_name: "Offline Mode", detail_1: "Work without internet", detail_2: "Auto-sync when connected", detail_3: "Offline data access", sort_order: 2 },
        { chapter: "12. MOBILE & FIELD OPERATIONS", feature_name: "Time Tracking & Timesheets", detail_1: "Clock in/out from mobile", detail_2: "Job-based time tracking", detail_3: "Timesheet approvals", sort_order: 3 },
        { chapter: "12. MOBILE & FIELD OPERATIONS", feature_name: "Field Photo Capture", detail_1: "Camera photo capture", detail_2: "Auto-attach to projects", detail_3: "Photo annotations on mobile", sort_order: 4 },
        { chapter: "12. MOBILE & FIELD OPERATIONS", feature_name: "Mobile Inspections", detail_1: "Inspection forms on mobile", detail_2: "Digital signatures", detail_3: "Instant inspection reports", sort_order: 5 },
        { chapter: "12. MOBILE & FIELD OPERATIONS", feature_name: "GPS & Location Services", detail_1: "Job site check-in", detail_2: "Location-based time tracking", detail_3: "Map view of sites", sort_order: 6 },
        { chapter: "12. MOBILE & FIELD OPERATIONS", feature_name: "Push Notifications", detail_1: "Real-time mobile alerts", detail_2: "Task reminders", detail_3: "Schedule updates", sort_order: 7 },

        # CHAPTER 13: Integrations & Automation
        { chapter: "13. INTEGRATIONS & AUTOMATION", feature_name: "Email Integration (Outlook/Gmail)", detail_1: "Email sync and filing", detail_2: "Email to project linking", detail_3: "Automated email workflows", sort_order: 1 },
        { chapter: "13. INTEGRATIONS & AUTOMATION", feature_name: "SMS Integration", detail_1: "SMS notifications", detail_2: "Two-way SMS communication", detail_3: "Bulk SMS messaging", sort_order: 2 },
        { chapter: "13. INTEGRATIONS & AUTOMATION", feature_name: "API Platform & Webhooks", detail_1: "REST API access", detail_2: "Webhook triggers", detail_3: "API documentation", sort_order: 3 },
        { chapter: "13. INTEGRATIONS & AUTOMATION", feature_name: "Zapier / Third-Party Apps", detail_1: "Zapier integration", detail_2: "Connect to 1000+ apps", detail_3: "Custom automation workflows", sort_order: 4 },
        { chapter: "13. INTEGRATIONS & AUTOMATION", feature_name: "Workflow Automation", detail_1: "Automated task creation", detail_2: "Status-based triggers", detail_3: "Notification automation", sort_order: 5 },
        { chapter: "13. INTEGRATIONS & AUTOMATION", feature_name: "AI-Powered Features", detail_1: "AI plan review and takeoffs", detail_2: "Intelligent material matching", detail_3: "Predictive analytics", sort_order: 6 },
        { chapter: "13. INTEGRATIONS & AUTOMATION", feature_name: "Materials Marketplace Integration", detail_1: "Supplier marketplace access", detail_2: "Real-time material pricing", detail_3: "Order directly from marketplace", sort_order: 7 }
      ]

      puts "\n✨ Creating #{new_features.count} new features..."
      puts "=" * 80

      created_count = 0
      new_features.each do |feature_data|
        feature = FeatureTracker.create!(
          chapter: feature_data[:chapter],
          feature_name: feature_data[:feature_name],
          detail_point_1: feature_data[:detail_1],
          detail_point_2: feature_data[:detail_2],
          detail_point_3: feature_data[:detail_3],
          sort_order: feature_data[:sort_order],
          dev_progress: 0,
          system_complete: false,
          dev_checked: false,
          tester_checked: false,
          ui_checked: false,
          user_checked: false,
          trapid_has: false,
          buildertrend_has: false,
          buildexact_has: false,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: false,
          simpro_has: false,
          smarterbuild_has: false,
          clickhome_has: false
        )
        created_count += 1
        puts "   ✓ #{feature.chapter}: #{feature.feature_name}"
      end

      puts "\n" + "=" * 80
      puts "✅ Successfully created #{created_count} features across 13 chapters"
      puts "\n📊 Chapter Summary:"

      FeatureTracker.select(:chapter).distinct.order(:chapter).each do |chapter|
        count = FeatureTracker.where(chapter: chapter.chapter).count
        puts "   #{chapter.chapter}: #{count} features"
      end

      puts "\n" + "=" * 80
      puts "🎯 Next Steps:"
      puts "   1. Run: bin/rails trapid:features:mark_implemented"
      puts "      (This will mark features with dev_progress > 0 as trapid_has = true)"
      puts ""
      puts "   2. Manually review and set competitor checkmarks"
      puts "      (Use the Features Tracking Table in the UI)"
      puts ""
      puts "   3. Set dev_progress percentages for each feature"
      puts "      (Based on current implementation status)"
      puts "=" * 80
    end
  end
end
