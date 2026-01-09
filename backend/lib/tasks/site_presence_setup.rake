# frozen_string_literal: true

namespace :site_presence do
  desc "Set up Foundation entries for Site Presence tables"
  task setup_foundations: :environment do
    puts "Setting up Foundation entries for Site Presence system..."

    foundations = [
      {
        name: "Worker Profiles",
        slug: "worker_profiles",
        database_table_name: "worker_profiles",
        model_class: "WorkerProfile",
        table_type: "system",
        description: "Unified employee and subcontractor profiles for site presence tracking"
      },
      {
        name: "Cost Centres",
        slug: "cost_centres",
        database_table_name: "cost_centres",
        model_class: "CostCentre",
        table_type: "system",
        description: "Hierarchical cost centres for P&L tracking and overhead allocation"
      },
      {
        name: "Site Presence Sessions",
        slug: "site_presence_sessions",
        database_table_name: "site_presence_sessions",
        model_class: "SitePresenceSession",
        table_type: "system",
        description: "Photo-verified check-in/checkout sessions for time tracking"
      },
      {
        name: "Labour Cost Entries",
        slug: "labour_cost_entries",
        database_table_name: "labour_cost_entries",
        model_class: "LabourCostEntry",
        table_type: "system",
        description: "simPRO-style labour cost tracking with overtime and overhead"
      },
      {
        name: "AI Timesheet Suggestions",
        slug: "ai_timesheet_suggestions",
        database_table_name: "ai_timesheet_suggestions",
        model_class: "AiTimesheetSuggestion",
        table_type: "system",
        description: "ML-generated timesheet suggestions from photos and GPS data"
      },
      {
        name: "Job Cost Budgets",
        slug: "job_cost_budgets",
        database_table_name: "job_cost_budgets",
        model_class: "JobCostBudget",
        table_type: "system",
        description: "Budget vs actuals tracking with alert thresholds"
      }
    ]

    foundations.each do |attrs|
      existing = Foundation.find_by(slug: attrs[:slug])
      if existing
        puts "  ✓ #{attrs[:name]} already exists (ID: #{existing.id})"
      else
        foundation = Foundation.create!(attrs)
        puts "  ✓ Created #{attrs[:name]} (ID: #{foundation.id})"

        # Sync columns from database schema
        sync_columns_for(foundation)
      end
    end

    puts "\nFoundation setup complete!"
  end

  desc "Sync columns from database schema for Site Presence foundations"
  task sync_columns: :environment do
    puts "Syncing columns for Site Presence foundations..."

    slugs = %w[worker_profiles cost_centres site_presence_sessions labour_cost_entries ai_timesheet_suggestions job_cost_budgets]

    slugs.each do |slug|
      foundation = Foundation.find_by(slug: slug)
      if foundation
        sync_columns_for(foundation)
        puts "  ✓ Synced #{foundation.name}"
      else
        puts "  ✗ Foundation not found: #{slug}"
      end
    end

    puts "\nColumn sync complete!"
  end

  desc "Create sample data for testing"
  task create_sample_data: :environment do
    puts "Creating sample data for Site Presence system..."

    # Create sample cost centres
    cc_admin = CostCentre.find_by(code: "CC-ADMIN")
    unless cc_admin
      cc_admin = CostCentre.create!(
        code: "CC-ADMIN",
        name: "Administration",
        centre_type: "department",
        overhead_allocation_percent: 15,
        active: true
      )
    end
    puts "  ✓ Cost Centre: #{cc_admin.name}"

    cc_residential = CostCentre.find_by(code: "CC-RES")
    unless cc_residential
      cc_residential = CostCentre.create!(
        code: "CC-RES",
        name: "Residential Projects",
        centre_type: "department",
        overhead_allocation_percent: 10,
        parent_id: cc_admin.id,
        active: true
      )
    end
    puts "  ✓ Cost Centre: #{cc_residential.name}"

    cc_commercial = CostCentre.find_by(code: "CC-COM")
    unless cc_commercial
      cc_commercial = CostCentre.create!(
        code: "CC-COM",
        name: "Commercial Projects",
        centre_type: "department",
        overhead_allocation_percent: 12,
        parent_id: cc_admin.id,
        active: true
      )
    end
    puts "  ✓ Cost Centre: #{cc_commercial.name}"

    # Create worker profiles for existing users
    User.order(:created_at).limit(5).each do |user|
      wp = WorkerProfile.find_by(user: user)
      unless wp
        rate = rand(45..85)
        wp = WorkerProfile.create!(
          user: user,
          worker_type: "employee",
          hourly_rate: rate,
          overtime_rate_1_5x: rate * 1.5,
          overtime_rate_2x: rate * 2,
          employment_cost_percent: 28.5,
          cost_centre: cc_residential,
          active: true
        )
      end
      puts "  ✓ Worker Profile: #{wp.display_name} (#{wp.worker_type})"
    rescue => e
      puts "  ✗ Skipped user #{user.id}: #{e.message}"
    end

    # Create worker profiles for some contacts (subcontractors with day rates)
    Contact.where.not(daily_rate_per_person: nil).or(Contact.where(entity_type: 'contractor')).limit(3).each do |contact|
      wp = WorkerProfile.find_by(contact: contact)
      unless wp
        wp = WorkerProfile.create!(
          contact: contact,
          worker_type: "subcontractor",
          day_rate: rand(400..800),
          call_out_fee: rand(100..200),
          cost_centre: cc_commercial,
          active: true
        )
      end
      puts "  ✓ Worker Profile: #{wp.display_name} (#{wp.worker_type})"
    rescue => e
      puts "  ✗ Skipped contact #{contact.id}: #{e.message}"
    end

    # Create sample job cost budgets (recent jobs)
    Job.order(created_at: :desc).limit(3).each do |job|
      budget = JobCostBudget.find_by(job: job)
      unless budget
        budget = JobCostBudget.create!(
          job: job,
          labour_budget: rand(10000..50000),
          materials_budget: rand(5000..25000),
          subcontractor_budget: rand(5000..30000),
          warning_threshold_percent: 80,
          critical_threshold_percent: 100
        )
      end
      puts "  ✓ Budget: #{job.name} ($#{budget.total_budget})"
    rescue => e
      puts "  ✗ Skipped job #{job.id}: #{e.message}"
    end

    puts "\nSample data creation complete!"
    puts "  - Cost Centres: #{CostCentre.count}"
    puts "  - Worker Profiles: #{WorkerProfile.count}"
    puts "  - Job Cost Budgets: #{JobCostBudget.count}"
  end

  desc "Add navigation items for Site Presence"
  task setup_navigation: :environment do
    puts "Adding Site Presence navigation items..."

    # Find or create a parent item for Site Presence
    parent = NavigationItem.find_by(name: "Site Presence")
    unless parent
      parent = NavigationItem.create!(
        name: "Site Presence",
        href: "/admin/site-presence",
        icon: "Clock",
        is_active: true,
        is_collapsed_default: true,
        position: NavigationItem.where(parent_id: nil).count
      )
    end
    puts "  ✓ Parent: #{parent.name}"

    # Child navigation items
    children = [
      { name: "Active Sessions", href: "/site_presence_sessions", icon: "Timer" },
      { name: "Worker Profiles", href: "/worker_profiles", icon: "Users" },
      { name: "Cost Centres", href: "/cost_centres", icon: "Building2" },
      { name: "Labour Costs", href: "/labour_cost_entries", icon: "DollarSign" },
      { name: "Job Budgets", href: "/job_cost_budgets", icon: "PieChart" },
      { name: "AI Suggestions", href: "/ai_timesheet_suggestions", icon: "Sparkles" }
    ]

    children.each_with_index do |attrs, idx|
      nav = NavigationItem.find_or_create_by!(name: attrs[:name], parent_id: parent.id) do |item|
        item.href = attrs[:href]
        item.icon = attrs[:icon]
        item.is_active = true
        item.position = idx
      end
      puts "  ✓ Child: #{nav.name}"
    end

    puts "\nNavigation setup complete!"
    puts "Site Presence menu added with #{children.length} items."
  end

  def sync_columns_for(foundation)
    return unless foundation.model_class.present?

    model = foundation.model_class.constantize
    db_columns = ActiveRecord::Base.connection.columns(foundation.database_table_name)

    db_columns.each do |col|
      next if %w[id created_at updated_at].include?(col.name)

      existing = foundation.columns.find_by(name: col.name)
      next if existing

      # Map database type to column type
      column_type = case col.type
                    when :string then "text"
                    when :text then "long_text"
                    when :integer, :bigint then "number"
                    when :decimal, :float then "currency"
                    when :boolean then "checkbox"
                    when :date then "date"
                    when :datetime then "datetime"
                    when :json, :jsonb then "json"
                    else "text"
      end

      # Handle foreign keys
      if col.name.end_with?("_id")
        column_type = "lookup"
      end

      foundation.columns.create!(
        name: col.name,
        label: col.name.titleize,
        column_type: column_type,
        position: foundation.columns.count + 1,
        visible: true,
        editable: true
      )
    end
  rescue => e
    puts "    Warning: Could not sync columns for #{foundation.name}: #{e.message}"
  end
end
