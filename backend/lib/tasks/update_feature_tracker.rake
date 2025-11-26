namespace :trapid do
  namespace :features do
    desc "Update feature tracker with comprehensive data including competitor comparison"
    task update_all: :environment do
      puts "=" * 80
      puts "🔄 UPDATING FEATURE TRACKER DATA"
      puts "=" * 80

      # Feature data with competitor analysis
      # Based on research of: BuilderTrend, Buildertrend, Simpro, CoConstruct, Procore, Jacks, etc.
      features_data = {
        # Chapter 1: Project Management
        "Job Management" => {
          dev_progress: 85,
          trapid_has: true,
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
        "Estimate Management" => {
          dev_progress: 75,
          trapid_has: true,
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
        "Purchase Order System" => {
          dev_progress: 80,
          trapid_has: true,
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

        # Chapter 2: Scheduling & Task Management
        "Schedule Master (Gantt Chart)" => {
          dev_progress: 90,
          trapid_has: true,
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
        "Schedule Templates" => {
          dev_progress: 70,
          trapid_has: true,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: false,
          wunderbuilt_has: true,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: true,
          clickhome_has: true,
          clickup_has: true
        },
        "Task Automation" => {
          dev_progress: 60,
          trapid_has: true,
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

        # Chapter 3: Financial Management
        "Real-Time Financial Tracking" => {
          dev_progress: 70,
          trapid_has: true,
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
        "Payment Management" => {
          dev_progress: 65,
          trapid_has: true,
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
        "Pay Now - Early Payment System" => {
          dev_progress: 40,
          trapid_has: true,
          buildertrend_has: false,
          buildexact_has: false,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: false,
          simpro_has: false,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: false
        },

        # Chapter 4: AI Powered Intelligence
        "AI Plan Review (Industry First)" => {
          dev_progress: 50,
          trapid_has: true,
          buildertrend_has: false,
          buildexact_has: false,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: false,
          simpro_has: false,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: false
        },
        "Intelligent Matching" => {
          dev_progress: 75,
          trapid_has: true,
          buildertrend_has: false,
          buildexact_has: false,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: false,
          simpro_has: false,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: false
        },
        "Real Impact Reporting" => {
          dev_progress: 30,
          trapid_has: true,
          buildertrend_has: false,
          buildexact_has: false,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: false,
          simpro_has: false,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: false
        },

        # Chapter 5: Supplier & Contact Management
        "Contact Management" => {
          dev_progress: 90,
          trapid_has: true,
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
        "Supplier Portal" => {
          dev_progress: 45,
          trapid_has: true,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: false
        },
        "Quote Request System" => {
          dev_progress: 60,
          trapid_has: true,
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

        # Chapter 6: Price Book & Cost Intelligence
        "Smart Material Cost Library" => {
          dev_progress: 85,
          trapid_has: true,
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
        "Bulk Operations" => {
          dev_progress: 80,
          trapid_has: true,
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

        # Chapter 7: Integrations Ecosystem
        "Xero Accounting Integration" => {
          dev_progress: 90,
          trapid_has: true,
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
        "Microsoft OneDrive Integration" => {
          dev_progress: 85,
          trapid_has: true,
          buildertrend_has: false,
          buildexact_has: false,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: false,
          simpro_has: false,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: false
        },
        "Microsoft Outlook Integration" => {
          dev_progress: 70,
          trapid_has: true,
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
        "SMS/Twilio Integration" => {
          dev_progress: 85,
          trapid_has: true,
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
        "Weather API Integration" => {
          dev_progress: 60,
          trapid_has: true,
          buildertrend_has: true,
          buildexact_has: false,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: false,
          simpro_has: false,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: false
        },

        # Chapter 8: Workplace Health & Safety (WHS)
        "SWMS (Safe Work Method Statements)" => {
          dev_progress: 30,
          trapid_has: true,
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
        "Inspections" => {
          dev_progress: 25,
          trapid_has: true,
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
        "Incidents & Near Misses" => {
          dev_progress: 20,
          trapid_has: true,
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
        "Inductions" => {
          dev_progress: 20,
          trapid_has: true,
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
        "WHS Dashboard" => {
          dev_progress: 15,
          trapid_has: true,
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

        # Chapter 9: Workflow Automation
        "Custom Workflow Designer" => {
          dev_progress: 40,
          trapid_has: true,
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
        "Workflow Features" => {
          dev_progress: 35,
          trapid_has: true,
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

        # Chapter 10: Custom Data Management
        "Table Builder (No-Code Database)" => {
          dev_progress: 95,
          trapid_has: true,
          buildertrend_has: false,
          buildexact_has: false,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: false,
          simpro_has: false,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: true
        },
        "TrapidTableView (Enterprise Table Component)" => {
          dev_progress: 95,
          trapid_has: true,
          buildertrend_has: false,
          buildexact_has: false,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: false,
          simpro_has: false,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: false
        },
        "Saved Views & Advanced Filtering" => {
          dev_progress: 90,
          trapid_has: true,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: false,
          simpro_has: true,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: true
        },

        # Chapter 11: Documentation & Knowledge Management
        "Trinity Documentation System" => {
          dev_progress: 90,
          trapid_has: true,
          buildertrend_has: false,
          buildexact_has: false,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: false,
          simpro_has: false,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: false
        },
        "User Manual" => {
          dev_progress: 70,
          trapid_has: true,
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

        # Chapter 12: Corporate & Compliance
        "Company Management" => {
          dev_progress: 85,
          trapid_has: true,
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
        "Asset Management" => {
          dev_progress: 30,
          trapid_has: true,
          buildertrend_has: false,
          buildexact_has: false,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: false,
          simpro_has: true,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: false
        },

        # Chapter 13: User Management & Security
        "Role-Based Access Control" => {
          dev_progress: 90,
          trapid_has: true,
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
        "Enterprise-Grade Security" => {
          dev_progress: 85,
          trapid_has: true,
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

        # Chapter 14: Reporting & Analytics
        "Operational Reports" => {
          dev_progress: 60,
          trapid_has: true,
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
        "Export Capabilities" => {
          dev_progress: 85,
          trapid_has: true,
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

        # Chapter 15: Communication
        "Team Chat" => {
          dev_progress: 30,
          trapid_has: true,
          buildertrend_has: true,
          buildexact_has: false,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: false,
          simpro_has: false,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: true
        },
        "Notifications" => {
          dev_progress: 75,
          trapid_has: true,
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

        # Chapter 16: Mobile & Accessibility
        "Mobile Support" => {
          dev_progress: 80,
          trapid_has: true,
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
        "Accessibility" => {
          dev_progress: 70,
          trapid_has: true,
          buildertrend_has: true,
          buildexact_has: true,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: true,
          simpro_has: true,
          smarterbuild_has: false,
          clickhome_has: true,
          clickup_has: true
        }
      }

      # Update existing features
      updated_count = 0
      not_found = []

      features_data.each do |feature_name, data|
        feature = FeatureTracker.find_by(feature_name: feature_name)
        if feature
          feature.update!(data)
          updated_count += 1
          progress_bar = "█" * (data[:dev_progress] / 10) + "░" * (10 - data[:dev_progress] / 10)
          puts "✓ #{feature_name.ljust(45)} [#{progress_bar}] #{data[:dev_progress]}%"
        else
          not_found << feature_name
        end
      end

      # Also update the duplicate "Intelligent Matching" in Chapter 6
      ch6_matching = FeatureTracker.joins(:feature_chapter)
        .where(feature_chapters: { chapter_number: 6 })
        .find_by(feature_name: "Intelligent Matching")
      if ch6_matching
        ch6_matching.update!(
          dev_progress: 75,
          trapid_has: true,
          buildertrend_has: false,
          buildexact_has: false,
          jacks_has: false,
          wunderbuilt_has: false,
          databuild_has: false,
          simpro_has: false,
          smarterbuild_has: false,
          clickhome_has: false,
          clickup_has: false
        )
        puts "✓ #{"Intelligent Matching (Ch6)".ljust(45)} [███████░░░] 75%"
        updated_count += 1
      end

      puts "\n" + "=" * 80
      puts "✅ Updated #{updated_count} features"

      if not_found.any?
        puts "\n⚠️  Features not found (#{not_found.count}):"
        not_found.each { |name| puts "   - #{name}" }
      end

      # Summary statistics
      puts "\n📊 SUMMARY BY CHAPTER:"
      puts "-" * 80
      FeatureChapter.order(:chapter_number).each do |chapter|
        features = chapter.feature_trackers
        avg_progress = features.average(:dev_progress).to_f.round(1)
        trapid_count = features.where(trapid_has: true).count
        total = features.count
        progress_bar = "█" * (avg_progress / 10).round + "░" * (10 - (avg_progress / 10).round)
        puts "Ch #{chapter.chapter_number.to_s.rjust(2)}: #{chapter.name.ljust(40)} [#{progress_bar}] #{avg_progress}% (#{trapid_count}/#{total} Trapid)"
      end

      puts "\n📈 OVERALL STATISTICS:"
      puts "-" * 80
      total_features = FeatureTracker.count
      avg_progress = FeatureTracker.average(:dev_progress).to_f.round(1)
      trapid_total = FeatureTracker.where(trapid_has: true).count

      puts "Total Features: #{total_features}"
      puts "Average Progress: #{avg_progress}%"
      puts "Trapid Has: #{trapid_total}/#{total_features} (#{(trapid_total.to_f/total_features*100).round(1)}%)"

      # Competitor summary
      puts "\n🏆 COMPETITOR COMPARISON:"
      puts "-" * 80
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
