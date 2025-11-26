namespace :trapid do
  namespace :features do
    desc "Add missing features that competitors have but Trapid doesn't"
    task add_missing: :environment do
      puts "=" * 80
      puts "➕ ADDING MISSING FEATURES (Competitors have, Trapid doesn't)"
      puts "=" * 80

      # Map chapter numbers to IDs
      chapter_ids = FeatureChapter.pluck(:chapter_number, :id).to_h

      # Features that competitors have but Trapid DOESN'T have (or has very limited)
      new_features = [
        # Chapter 3: Financial Management - we don't have full accounting
        {
          chapter_number: 3,
          feature_name: "Built-in Accounting System",
          detail_point_1: "Full general ledger",
          detail_point_2: "Bank reconciliation",
          detail_point_3: "BAS/GST reporting",
          trapid_has: false,
          buildertrend_has: false,
          buildexact_has: true,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: false,
          clickhome_has: true,
          clickup_has: false
        },
        {
          chapter_number: 3,
          feature_name: "Payroll System",
          detail_point_1: "Employee payroll processing",
          detail_point_2: "Super/tax calculations",
          detail_point_3: "Timesheet to pay integration",
          trapid_has: false,
          buildertrend_has: false,
          buildexact_has: true,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: false
        },
        {
          chapter_number: 3,
          feature_name: "Progress Claims / Invoicing",
          detail_point_1: "Progress claim generation",
          detail_point_2: "Client invoicing",
          detail_point_3: "Payment tracking",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: true,
          wunderbuilt_has: true,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: true,
          clickhome_has: true,
          clickup_has: false
        },

        # Chapter 5: We don't have client portal
        {
          chapter_number: 5,
          feature_name: "Client Portal",
          detail_point_1: "Client login and dashboard",
          detail_point_2: "Document sharing with clients",
          detail_point_3: "Selection management",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: true,
          wunderbuilt_has: true,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: true,
          clickhome_has: true,
          clickup_has: false
        },
        {
          chapter_number: 5,
          feature_name: "Subcontractor Portal",
          detail_point_1: "Subbie login and scheduling",
          detail_point_2: "Timesheet submission",
          detail_point_3: "Invoice submission",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: false,
          clickhome_has: true,
          clickup_has: false
        },

        # Chapter 2: Scheduling - we don't have resource management
        {
          chapter_number: 2,
          feature_name: "Resource/Crew Management",
          detail_point_1: "Manage crews and teams",
          detail_point_2: "Resource availability calendar",
          detail_point_3: "Workload balancing",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: true,
          wunderbuilt_has: true,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: true,
          clickhome_has: true,
          clickup_has: true
        },
        {
          chapter_number: 2,
          feature_name: "Time Tracking / Timesheets",
          detail_point_1: "Clock in/out functionality",
          detail_point_2: "Job-based time tracking",
          detail_point_3: "Timesheet approvals",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: true,
          wunderbuilt_has: true,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: true,
          clickhome_has: true,
          clickup_has: true
        },

        # Chapter 7: Integrations we don't have
        {
          chapter_number: 7,
          feature_name: "QuickBooks Integration",
          detail_point_1: "Two-way sync with QuickBooks",
          detail_point_2: "Invoice sync",
          detail_point_3: "Customer/vendor sync",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: true,
          wunderbuilt_has: true,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: true,
          clickhome_has: true,
          clickup_has: false
        },
        {
          chapter_number: 7,
          feature_name: "MYOB Integration",
          detail_point_1: "Two-way sync with MYOB",
          detail_point_2: "Financial data sync",
          detail_point_3: "Eliminate double entry",
          trapid_has: false,
          buildertrend_has: false,
          buildexact_has: true,
          jacks_has: true,
          wunderbuilt_has: true,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: true,
          clickhome_has: true,
          clickup_has: false
        },
        {
          chapter_number: 7,
          feature_name: "Google Calendar Sync",
          detail_point_1: "Two-way calendar sync",
          detail_point_2: "Event creation from tasks",
          detail_point_3: "Team calendar sharing",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: false,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: false,
          simpro_has: true,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: true
        },

        # Chapter 8: WHS - more specific features
        {
          chapter_number: 8,
          feature_name: "Toolbox Talks",
          detail_point_1: "Pre-start meeting templates",
          detail_point_2: "Attendance tracking",
          detail_point_3: "Topic library",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: true,
          wunderbuilt_has: true,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: true,
          clickhome_has: true,
          clickup_has: false
        },

        # Chapter 1: Project Management - defects/warranty
        {
          chapter_number: 1,
          feature_name: "Defects & Warranty Management",
          detail_point_1: "Defect logging and tracking",
          detail_point_2: "Warranty period management",
          detail_point_3: "Remedial work scheduling",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: true,
          wunderbuilt_has: true,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: true,
          clickhome_has: true,
          clickup_has: false
        },
        {
          chapter_number: 1,
          feature_name: "Change Orders / Variations",
          detail_point_1: "Variation request workflow",
          detail_point_2: "Client approval process",
          detail_point_3: "Cost impact tracking",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: true,
          wunderbuilt_has: true,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: true,
          clickhome_has: true,
          clickup_has: false
        },
        {
          chapter_number: 1,
          feature_name: "Daily Logs / Site Diary",
          detail_point_1: "Daily site activity logging",
          detail_point_2: "Weather and workforce notes",
          detail_point_3: "Photo attachments",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: true,
          wunderbuilt_has: true,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: true,
          clickhome_has: true,
          clickup_has: false
        },

        # Chapter 14: Reporting
        {
          chapter_number: 14,
          feature_name: "Financial Reports",
          detail_point_1: "P&L by project",
          detail_point_2: "Budget vs actual",
          detail_point_3: "Cash position reports",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: true,
          wunderbuilt_has: true,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: true,
          clickhome_has: true,
          clickup_has: false
        },
        {
          chapter_number: 14,
          feature_name: "Custom Report Builder",
          detail_point_1: "Drag-and-drop report design",
          detail_point_2: "Custom field selection",
          detail_point_3: "Saved report templates",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: false,
          clickhome_has: true,
          clickup_has: true
        },

        # Chapter 16: Mobile
        {
          chapter_number: 16,
          feature_name: "Native Mobile App (iOS/Android)",
          detail_point_1: "Dedicated mobile apps",
          detail_point_2: "Offline capability",
          detail_point_3: "Push notifications",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: true,
          wunderbuilt_has: true,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: true,
          clickhome_has: true,
          clickup_has: true
        },

        # Chapter 6: Price Book
        {
          chapter_number: 6,
          feature_name: "Supplier Price Updates",
          detail_point_1: "Automatic price feeds",
          detail_point_2: "Supplier catalog integration",
          detail_point_3: "Price change alerts",
          trapid_has: false,
          buildertrend_has: false,
          buildexact_has: true,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: false
        },

        # Chapter 12: Compliance
        {
          chapter_number: 12,
          feature_name: "License & Insurance Tracking",
          detail_point_1: "Expiry alerts",
          detail_point_2: "Document storage",
          detail_point_3: "Compliance reports",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: true,
          wunderbuilt_has: true,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: true,
          clickhome_has: true,
          clickup_has: false
        },

        # Chapter 15: Communication
        {
          chapter_number: 15,
          feature_name: "In-App Messaging",
          detail_point_1: "Direct messaging",
          detail_point_2: "Group conversations",
          detail_point_3: "File sharing in chat",
          trapid_has: false,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: true,
          simpro_has: false,
          smarterbuild_has: false,
          clickhome_has: true,
          clickup_has: true
        }
      ]

      created_count = 0
      new_features.each do |data|
        chapter_id = chapter_ids[data[:chapter_number]]
        unless chapter_id
          puts "⚠️  Chapter #{data[:chapter_number]} not found, skipping #{data[:feature_name]}"
          next
        end

        # Check if feature already exists
        existing = FeatureTracker.find_by(feature_name: data[:feature_name])
        if existing
          puts "   ⏭️  #{data[:feature_name]} already exists, skipping"
          next
        end

        feature = FeatureTracker.create!(
          feature_chapter_id: chapter_id,
          chapter: "#{data[:chapter_number]}. #{FeatureChapter.find(chapter_id).name.upcase}",
          feature_name: data[:feature_name],
          detail_point_1: data[:detail_point_1],
          detail_point_2: data[:detail_point_2],
          detail_point_3: data[:detail_point_3],
          dev_progress: data[:trapid_has] ? 50 : 0,
          system_complete: false,
          dev_checked: false,
          tester_checked: false,
          ui_checked: false,
          user_checked: false,
          trapid_has: data[:trapid_has],
          buildertrend_has: data[:buildertrend_has],
          buildexact_has: data[:buildexact_has],
          jacks_has: data[:jacks_has],
          wunderbuilt_has: data[:wunderbuilt_has],
          databuild_has: data[:databuild_has],
          simpro_has: data[:simpro_has],
          smarterbuild_has: data[:smarterbuild_has],
          clickhome_has: data[:clickhome_has],
          clickup_has: data[:clickup_has]
        )
        trapid_status = data[:trapid_has] ? "✓" : "✗"
        puts "   #{trapid_status} Added: #{data[:feature_name]} (Ch#{data[:chapter_number]})"
        created_count += 1
      end

      puts "\n" + "=" * 80
      puts "✅ Added #{created_count} new features"

      # Now show updated competitor comparison
      puts "\n🏆 UPDATED COMPETITOR COMPARISON:"
      puts "-" * 80
      total_features = FeatureTracker.count

      competitors = {
        "Trapid" => :trapid_has,
        "BuilderTrend" => :buildertrend_has,
        "BuildExact" => :buildexact_has,
        "Jacks" => :jacks_has,
        "Wunderbuilt" => :wunderbuilt_has,
        "DataBuild" => :databuild_has,
        "Simpro" => :simpro_has,
        "SmarterBuild" => :smarterbuild_has,
        "ClickHome" => :clickhome_has,
        "ClickUp" => :clickup_has
      }

      competitors.each do |name, field|
        count = FeatureTracker.where(field => true).count
        pct = (count.to_f / total_features * 100).round(1)
        bar = "█" * (pct / 10).round + "░" * (10 - (pct / 10).round)
        puts "#{name.ljust(15)} [#{bar}] #{count}/#{total_features} (#{pct}%)"
      end

      puts "\n" + "=" * 80
    end
  end
end
