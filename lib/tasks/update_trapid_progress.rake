namespace :trapid do
  namespace :features do
    desc "Update Trapid feature progress percentages based on current implementation"
    task update_progress: :environment do
      puts "🎯 Updating Trapid feature progress percentages..."
      puts "=" * 80

      # Define progress for each feature based on current Trapid implementation
      # Format: { "Feature Name" => progress_percentage }

      feature_progress = {
        # Chapter 1: Pre-Construction & Sales (Heavy development - 60% avg)
        "Lead Capture & CRM" => 5,
        "Lead Nurturing & Email Marketing" => 0,
        "Estimating & Takeoffs" => 80,
        "Quote/Proposal Generation" => 75,
        "Digital Signatures & Contracts" => 5,
        "Tender Management" => 0,
        "Pre-Construction Workflow & Approvals" => 0,

        # Chapter 2: Project Setup & Job Management (Strong - 75% avg)
        "Project/Job Creation" => 85,
        "Project Templates" => 70,
        "Budget Setup & Tracking" => 85,
        "Job Status Management" => 85,
        "Change Orders / Variations" => 80,
        "Daily Logs / Site Diary" => 65,
        "Job Costing" => 90,

        # Chapter 3: Scheduling & Coordination (Very Strong - 78% avg)
        "Gantt Chart Scheduling" => 80,
        "Critical Path Analysis" => 75,
        "Schedule Templates" => 90,
        "Task Management & Dependencies" => 85,
        "Calendar Views" => 70,
        "Trade Call-Ups & Notifications" => 65,
        "Automatic Schedule Adjustments" => 80,

        # Chapter 4: Financial Management (Excellent - 82% avg)
        "Budgeting & Cost Tracking" => 90,
        "Purchase Orders" => 95,
        "Invoicing & Progress Claims" => 85,
        "Payment Processing" => 80,
        "Cashflow Forecasting" => 70,
        "Expense Tracking" => 75,
        "Financial Reconciliation" => 80,

        # Chapter 5: Accounting Integration (Good Xero, needs others - 48% avg)
        "Xero Integration" => 95,
        "QuickBooks Integration" => 10,
        "MYOB Integration" => 5,
        "Auto Invoice Checking" => 60,
        "Real-Time Financial Sync" => 85,
        "Bank Reconciliation" => 70,
        "Payroll Integration (Australia)" => 0,

        # Chapter 6: Client Portal & Communication (Moderate - 35% avg)
        "Client Portal Access" => 25,
        "Project Progress Updates" => 30,
        "Selections Management" => 40,
        "Document Sharing (Client View)" => 35,
        "Client Approvals" => 30,
        "Messaging & Notifications" => 45,
        "Photo Galleries for Clients" => 20,

        # Chapter 7: Supplier & Subcontractor Management (Strong - 72% avg)
        "Supplier Database" => 85,
        "Subcontractor Database" => 85,
        "Supplier Portal" => 90,
        "Subcontractor Portal" => 70,
        "Quote Requests (RFQ)" => 85,
        "Trade Scheduling & Call-Ups" => 65,
        "Pricing Database & Assemblies" => 75,

        # Chapter 8: Document & File Management (Good OneDrive base - 58% avg)
        "Cloud File Storage" => 90,
        "Plan/Drawing Management" => 50,
        "Photo Management" => 60,
        "Document Templates" => 45,
        "Version Control" => 55,
        "Document Sharing & Permissions" => 70,
        "Electronic Filing System" => 35,

        # Chapter 9: Safety & Compliance (Excellent WHS - 82% avg)
        "SWMS / JSA Management" => 95,
        "Site Inspections (Safety)" => 90,
        "Incident & Near Miss Reporting" => 85,
        "Site Inductions" => 90,
        "Safety Dashboard & Alerts" => 80,
        "OH&S Compliance Tracking" => 75,
        "Risk Management" => 60,

        # Chapter 10: Quality & Site Management (Moderate - 30% avg)
        "Quality Inspections (Trade)" => 35,
        "Quality Inspections (Supervisor)" => 35,
        "Defects Management" => 40,
        "Handover Checklists" => 25,
        "Warranty Management" => 20,
        "Practical Completion" => 30,
        "Final Signoffs" => 25,

        # Chapter 11: Reporting & Analytics (Strong - 77% avg)
        "Financial Reports" => 90,
        "Project Dashboards" => 85,
        "Custom Report Builder" => 60,
        "Performance Metrics" => 75,
        "Profitability Analysis" => 80,
        "Excel/PDF Export" => 95,
        "One-Click Reports" => 55,

        # Chapter 12: Mobile & Field Operations (Weak - needs work - 8% avg)
        "Mobile App (iOS/Android)" => 5,
        "Offline Mode" => 0,
        "Time Tracking & Timesheets" => 15,
        "Field Photo Capture" => 10,
        "Mobile Inspections" => 5,
        "GPS & Location Services" => 0,
        "Push Notifications" => 20,

        # Chapter 13: Integrations & Automation (Strong - 68% avg)
        "Email Integration (Outlook/Gmail)" => 90,
        "SMS Integration" => 85,
        "API Platform & Webhooks" => 50,
        "Zapier / Third-Party Apps" => 20,
        "Workflow Automation" => 75,
        "AI-Powered Features" => 85,
        "Materials Marketplace Integration" => 70
      }

      updated_count = 0
      feature_progress.each do |feature_name, progress|
        feature = FeatureTracker.find_by(feature_name: feature_name)

        if feature
          if feature.update(dev_progress: progress)
            updated_count += 1

            # Visual progress indicator
            if progress >= 90
              icon = "🔨"
            elsif progress >= 70
              icon = "🏗️"
            elsif progress >= 50
              icon = "⚙️"
            elsif progress >= 25
              icon = "⏳"
            elsif progress > 0
              icon = "📋"
            else
              icon = "📝"
            end

            puts "   #{icon} #{feature_name.ljust(45)}: #{progress.to_s.rjust(3)}%"
          end
        else
          puts "   ✗ Feature not found: #{feature_name}"
        end
      end

      puts "\n" + "=" * 80
      puts "✅ Successfully updated #{updated_count} feature progress percentages"

      # Calculate chapter averages
      puts "\n📊 Chapter Progress Summary:"

      chapters = FeatureTracker.select(:chapter).distinct.order(:chapter)
      chapters.each do |chapter|
        features = FeatureTracker.where(chapter: chapter.chapter)
        avg_progress = features.average(:dev_progress).to_f.round(1)
        total_features = features.count

        # Visual indicator for chapter
        if avg_progress >= 75
          status = "🔥 Excellent"
        elsif avg_progress >= 60
          status = "✅ Strong"
        elsif avg_progress >= 40
          status = "⚙️ Moderate"
        elsif avg_progress >= 20
          status = "⏳ Early"
        else
          status = "📝 Planned"
        end

        puts "   #{chapter.chapter.ljust(45)}: #{avg_progress.to_s.rjust(5)}% #{status}"
      end

      # Overall Trapid progress
      total_avg = FeatureTracker.average(:dev_progress).to_f.round(1)
      puts "\n📈 Overall Trapid Progress: #{total_avg}%"

      puts "\n" + "=" * 80
      puts "🎯 Next Steps:"
      puts "   1. Run: bin/rails trapid:features:mark_implemented"
      puts "      (This will mark features with dev_progress > 0 as trapid_has = true)"
      puts ""
      puts "   2. Refresh the Dashboard to see updated progress bars"
      puts ""
      puts "   3. Review chapter percentages in the UI"
      puts "=" * 80
    end
  end
end
