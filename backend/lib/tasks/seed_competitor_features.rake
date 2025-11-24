namespace :trapid do
  namespace :features do
    desc "Seed competitor feature checkmarks based on competitive research"
    task competitive_seed: :environment do
      puts "🔍 Seeding competitor features based on competitive research..."
      puts "=" * 80

      # Define which competitors have which features based on research
      # Format: { "Feature Name" => [:competitor1, :competitor2, ...] }

      competitor_features = {
        # Chapter 1: Pre-Construction & Sales
        "Lead Capture & CRM" => [:buildertrend, :buildexact, :clickhome, :jacks, :wunderbuilt],
        "Lead Nurturing & Email Marketing" => [:buildertrend, :clickhome],
        "Estimating & Takeoffs" => [:buildertrend, :buildexact, :jacks, :wunderbuilt, :databuild, :simpro, :smartebuild, :clickhome],
        "Quote/Proposal Generation" => [:buildertrend, :buildexact, :jacks, :wunderbuilt, :databuild, :simpro, :smartebuild, :clickhome],
        "Digital Signatures & Contracts" => [:buildertrend, :buildexact, :jacks, :clickhome],
        "Tender Management" => [:wunderbuilt, :clickhome],
        "Pre-Construction Workflow & Approvals" => [:clickhome, :wunderbuilt],

        # Chapter 2: Project Setup & Job Management
        "Project/Job Creation" => [:buildertrend, :buildexact, :jacks, :wunderbuilt, :databuild, :simpro, :smartebuild, :clickhome],
        "Project Templates" => [:buildertrend, :jacks, :wunderbuilt, :smartebuild, :clickhome],
        "Budget Setup & Tracking" => [:buildertrend, :buildexact, :jacks, :wunderbuilt, :databuild, :simpro, :smartebuild, :clickhome],
        "Job Status Management" => [:buildertrend, :buildexact, :jacks, :wunderbuilt, :databuild, :simpro, :smartebuild, :clickhome],
        "Change Orders / Variations" => [:buildertrend, :jacks, :wunderbuilt, :clickhome],
        "Daily Logs / Site Diary" => [:buildertrend, :wunderbuilt, :smartebuild],
        "Job Costing" => [:buildertrend, :jacks, :wunderbuilt, :databuild, :simpro, :smartebuild],

        # Chapter 3: Scheduling & Coordination
        "Gantt Chart Scheduling" => [:buildertrend, :jacks, :wunderbuilt, :smartebuild],
        "Critical Path Analysis" => [:wunderbuilt],
        "Schedule Templates" => [:buildertrend, :jacks, :wunderbuilt, :smartebuild],
        "Task Management & Dependencies" => [:buildertrend, :jacks, :wunderbuilt, :smartebuild, :clickhome],
        "Calendar Views" => [:buildertrend, :jacks, :simpro, :clickhome],
        "Trade Call-Ups & Notifications" => [:smartebuild, :clickhome],
        "Automatic Schedule Adjustments" => [:wunderbuilt, :smartebuild],

        # Chapter 4: Financial Management
        "Budgeting & Cost Tracking" => [:buildertrend, :buildexact, :jacks, :wunderbuilt, :databuild, :simpro, :smartebuild, :clickhome],
        "Purchase Orders" => [:buildertrend, :jacks, :wunderbuilt, :databuild, :smartebuild, :clickhome],
        "Invoicing & Progress Claims" => [:buildertrend, :buildexact, :jacks, :wunderbuilt, :databuild, :simpro, :smartebuild, :clickhome],
        "Payment Processing" => [:buildertrend, :simpro],
        "Cashflow Forecasting" => [:jacks, :smartebuild],
        "Expense Tracking" => [:buildertrend, :simpro],
        "Financial Reconciliation" => [:buildertrend, :databuild, :wunderbuilt],

        # Chapter 5: Accounting Integration
        "Xero Integration" => [:buildertrend, :jacks, :wunderbuilt, :databuild, :simpro, :smartebuild],
        "QuickBooks Integration" => [:buildertrend, :wunderbuilt],
        "MYOB Integration" => [:wunderbuilt, :databuild],
        "Auto Invoice Checking" => [:databuild],
        "Real-Time Financial Sync" => [:buildertrend, :wunderbuilt, :databuild],
        "Bank Reconciliation" => [:buildertrend, :databuild],
        "Payroll Integration (Australia)" => [:databuild],

        # Chapter 6: Client Portal & Communication
        "Client Portal Access" => [:buildertrend, :jacks, :wunderbuilt, :clickhome],
        "Project Progress Updates" => [:buildertrend, :wunderbuilt, :clickhome],
        "Selections Management" => [:buildertrend, :jacks, :clickhome],
        "Document Sharing (Client View)" => [:buildertrend, :wunderbuilt, :clickhome],
        "Client Approvals" => [:buildertrend, :wunderbuilt, :clickhome],
        "Messaging & Notifications" => [:buildertrend, :wunderbuilt, :clickhome],
        "Photo Galleries for Clients" => [:buildertrend],

        # Chapter 7: Supplier & Subcontractor Management
        "Supplier Database" => [:buildertrend, :buildexact, :jacks, :wunderbuilt, :databuild, :simpro, :clickhome],
        "Subcontractor Database" => [:buildertrend, :buildexact, :jacks, :wunderbuilt, :simpro, :clickhome],
        "Supplier Portal" => [:buildertrend, :clickhome],
        "Subcontractor Portal" => [:buildertrend, :jacks, :clickhome],
        "Quote Requests (RFQ)" => [:buildertrend, :buildexact, :jacks, :wunderbuilt],
        "Trade Scheduling & Call-Ups" => [:buildertrend, :jacks, :simpro, :smartebuild, :clickhome],
        "Pricing Database & Assemblies" => [:buildexact, :wunderbuilt, :databuild, :simpro],

        # Chapter 8: Document & File Management
        "Cloud File Storage" => [:buildertrend, :buildexact, :jacks, :wunderbuilt, :clickhome],
        "Plan/Drawing Management" => [:buildertrend, :buildexact, :simpro, :clickhome],
        "Photo Management" => [:buildertrend, :buildexact, :jacks, :clickhome],
        "Document Templates" => [:buildertrend, :buildexact, :wunderbuilt, :clickhome],
        "Version Control" => [:buildertrend, :wunderbuilt],
        "Document Sharing & Permissions" => [:buildertrend, :wunderbuilt, :clickhome],
        "Electronic Filing System" => [:buildertrend, :wunderbuilt, :databuild],

        # Chapter 9: Safety & Compliance
        "SWMS / JSA Management" => [:jacks],
        "Site Inspections (Safety)" => [:buildertrend, :clickhome],
        "Incident & Near Miss Reporting" => [:buildertrend],
        "Site Inductions" => [:buildertrend, :clickhome],
        "Safety Dashboard & Alerts" => [:buildertrend],
        "OH&S Compliance Tracking" => [:clickhome],
        "Risk Management" => [:buildertrend, :wunderbuilt],

        # Chapter 10: Quality & Site Management
        "Quality Inspections (Trade)" => [:buildertrend, :clickhome],
        "Quality Inspections (Supervisor)" => [:buildertrend, :clickhome],
        "Defects Management" => [:buildertrend, :clickhome],
        "Handover Checklists" => [:buildertrend, :clickhome],
        "Warranty Management" => [:buildertrend],
        "Practical Completion" => [:buildertrend, :clickhome],
        "Final Signoffs" => [:buildertrend, :clickhome],

        # Chapter 11: Reporting & Analytics
        "Financial Reports" => [:buildertrend, :jacks, :wunderbuilt, :databuild, :simpro, :smartebuild, :clickhome],
        "Project Dashboards" => [:buildertrend, :jacks, :wunderbuilt, :clickhome],
        "Custom Report Builder" => [:buildertrend, :simpro],
        "Performance Metrics" => [:buildertrend, :buildexact, :clickhome],
        "Profitability Analysis" => [:buildertrend, :jacks, :databuild],
        "Excel/PDF Export" => [:buildertrend, :buildexact, :jacks, :wunderbuilt, :databuild, :smartebuild],
        "One-Click Reports" => [:smartebuild],

        # Chapter 12: Mobile & Field Operations
        "Mobile App (iOS/Android)" => [:buildertrend, :buildexact, :jacks, :wunderbuilt, :simpro, :smartebuild, :clickhome],
        "Offline Mode" => [:buildertrend, :simpro, :clickhome],
        "Time Tracking & Timesheets" => [:buildertrend, :jacks, :simpro],
        "Field Photo Capture" => [:buildertrend, :buildexact, :jacks, :clickhome],
        "Mobile Inspections" => [:buildertrend, :simpro, :clickhome],
        "GPS & Location Services" => [:buildertrend, :simpro],
        "Push Notifications" => [:buildertrend, :wunderbuilt, :simpro],

        # Chapter 13: Integrations & Automation
        "Email Integration (Outlook/Gmail)" => [:buildertrend],
        "SMS Integration" => [:buildertrend, :simpro],
        "API Platform & Webhooks" => [:buildertrend, :simpro],
        "Zapier / Third-Party Apps" => [:buildertrend],
        "Workflow Automation" => [:buildertrend, :simpro],
        "AI-Powered Features" => [:buildexact],
        "Materials Marketplace Integration" => [:buildertrend]
      }

      # Competitor name mapping
      competitor_columns = {
        buildertrend: :buildertrend_has,
        buildexact: :buildexact_has,
        jacks: :jacks_has,
        wunderbuilt: :wunderbuilt_has,
        databuild: :databuild_has,
        simpro: :simpro_has,
        smartebuild: :smarterbuild_has,
        clickhome: :clickhome_has
      }

      updated_count = 0
      competitor_features.each do |feature_name, competitors|
        feature = FeatureTracker.find_by(feature_name: feature_name)

        if feature
          update_hash = {}
          competitors.each do |competitor|
            column = competitor_columns[competitor]
            update_hash[column] = true if column
          end

          if feature.update(update_hash)
            updated_count += 1
            competitor_names = competitors.map { |c| c.to_s.capitalize }.join(", ")
            puts "   ✓ #{feature_name}: #{competitor_names}"
          end
        else
          puts "   ✗ Feature not found: #{feature_name}"
        end
      end

      puts "\n" + "=" * 80
      puts "✅ Successfully updated #{updated_count} features with competitor data"

      # Show summary statistics
      puts "\n📊 Competitor Feature Coverage:"

      competitor_columns.each do |name, column|
        count = FeatureTracker.where(column => true).count
        total = FeatureTracker.count
        percentage = (count.to_f / total * 100).round(1)
        puts "   #{name.to_s.capitalize.ljust(15)}: #{count.to_s.rjust(2)}/#{total} features (#{percentage}%)"
      end

      puts "\n📈 Trapid Feature Coverage:"
      trapid_count = FeatureTracker.where(trapid_has: true).count
      total = FeatureTracker.count
      trapid_percentage = (trapid_count.to_f / total * 100).round(1)
      puts "   Trapid          : #{trapid_count.to_s.rjust(2)}/#{total} features (#{trapid_percentage}%)"

      puts "\n" + "=" * 80
      puts "🎯 Next Steps:"
      puts "   1. Review the Features Tracking Table in the UI"
      puts "   2. Verify competitor checkmarks are accurate"
      puts "   3. Research any unclear features for competitors"
      puts "   4. Update Trapid progress percentages"
      puts "=" * 80
    end
  end
end
