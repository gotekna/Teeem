namespace :teeem do
  desc "Create Foundation records for all system Rails models (reads from database schema)"
  task create_system_foundations: :environment do
    puts "\n🔧 Creating system foundations from Rails models..."
    puts "=" * 80

    # Define all system models that should have foundations
    # This reads directly from the database schema - the source of truth
    system_models = [
      { model: "Job", icon: "🏗️", feature: "Jobs" },
      { model: "User", icon: "👥", feature: "Company", name: "User Management" },
      { model: "Contact", icon: "👤", feature: "Contacts" },
      { model: "Supplier", icon: "🏭", feature: "Suppliers" },
      { model: "PurchaseOrder", icon: "📦", feature: "Purchase Orders" },
      { model: "Estimate", icon: "📊", feature: "Estimates" },
      { model: "PricebookItem", icon: "💰", feature: "Pricebook" },
      { model: "PriceHistory", icon: "📈", feature: "Pricebook" },
      { model: "SmTask", icon: "📅", feature: "Schedule Manager", name: "SM Tasks" },
      { model: "SmResource", icon: "👷", feature: "Schedule Manager", name: "SM Resources" },
      { model: "Project", icon: "📋", feature: "Projects" },
      { model: "ProjectTask", icon: "✓", feature: "Projects" },
      { model: "Role", icon: "🔐", feature: "Company", name: "Roles" },
      { model: "JobType", icon: "📁", feature: "Jobs", name: "Job Types" },
      { model: "JobStatus", icon: "🚦", feature: "Jobs", name: "Job Statuses" },
      { model: "JobStage", icon: "📊", feature: "Jobs", name: "Job Stages" },
      { model: "Meeting", icon: "📅", feature: "Meetings" },
      { model: "MeetingType", icon: "🏷️", feature: "Meetings", name: "Meeting Types" },
      { model: "WhsSwms", icon: "⚠️", feature: "WHS", name: "SWMS" },
      { model: "WhsInduction", icon: "📋", feature: "WHS", name: "Inductions" },
      { model: "WhsInspection", icon: "🔍", feature: "WHS", name: "Inspections" },
      { model: "WhsIncident", icon: "🚨", feature: "WHS", name: "Incidents" },
      { model: "Trinity", icon: "📚", feature: "Documentation" },
      { model: "GoldStandardTable", icon: "⭐", feature: "System", name: "Gold Standard" },
      { model: "InspiringQuote", icon: "💬", feature: "System", name: "Inspiring Quotes" },
      { model: "ScheduleTemplate", icon: "📋", feature: "Schedule Manager", name: "Schedule Templates" },
      { model: "FolderTemplate", icon: "📁", feature: "System", name: "Folder Templates" },
      # Added for TeeemTableView migration
      { model: "Lead", icon: "🎯", feature: "Sales", name: "Leads" },
      { model: "QuoteRequest", icon: "📝", feature: "Procurement", name: "Quote Requests" },
      { model: "Document", icon: "📄", feature: "Documents" },
      { model: "TaskTemplate", icon: "📋", feature: "Templates", name: "Task Templates" },
      { model: "EmailJobProposal", icon: "📧", feature: "Sales", name: "Email Proposals" },
      { model: "PortalUser", icon: "🌐", feature: "Portal", name: "Portal Users" },
      { model: "BillInbox", icon: "📬", feature: "Finance", name: "Bill Inbox" }
    ]

    created = 0
    updated = 0
    skipped = 0
    errors = 0

    system_models.each do |config|
      model_class = config[:model]

      begin
        # Verify the model exists
        klass = model_class.constantize
        table_name = klass.table_name

        # Check if table exists in database
        unless ActiveRecord::Base.connection.table_exists?(table_name)
          puts "  ⚠️  #{model_class}: Table '#{table_name}' doesn't exist - skipping"
          skipped += 1
          next
        end

        # Generate foundation attributes
        name = config[:name] || model_class.titleize.pluralize
        slug = name.parameterize

        # Find or create foundation
        foundation = Foundation.find_by(model_class: model_class)

        if foundation
          # Update existing
          foundation.update!(
            name: name,
            slug: slug,
            database_table_name: table_name,
            table_type: "system",
            icon: config[:icon],
            feature: config[:feature],
            is_live: true,
            has_ui: true
          )
          puts "  ✏️  #{name} (ID: #{foundation.id}) - updated"
          updated += 1
        else
          # Create new
          foundation = Foundation.create!(
            name: name,
            singular_name: model_class.titleize,
            plural_name: name,
            slug: slug,
            database_table_name: table_name,
            table_type: "system",
            model_class: model_class,
            icon: config[:icon],
            feature: config[:feature],
            is_live: true,
            has_ui: true,
            allow_reserved_name: true
          )
          puts "  ✅ #{name} (ID: #{foundation.id}) - created"
          created += 1
        end

        # Sync columns from database schema
        sync_columns_for_foundation(foundation, klass)

      rescue NameError => e
        puts "  ❌ #{model_class}: Model not found - #{e.message}"
        errors += 1
      rescue => e
        puts "  ❌ #{model_class}: Error - #{e.message}"
        errors += 1
      end
    end

    puts "\n" + "=" * 80
    puts "✨ Complete!"
    puts "  ✅ Created: #{created}"
    puts "  ✏️  Updated: #{updated}"
    puts "  ⏭️  Skipped: #{skipped}"
    puts "  ❌ Errors: #{errors}"
    puts "=" * 80
  end

  def sync_columns_for_foundation(foundation, klass)
    table_name = klass.table_name
    db_columns = ActiveRecord::Base.connection.columns(table_name)

    existing_columns = foundation.columns.pluck(:column_name)

    db_columns.each_with_index do |db_col, index|
      next if existing_columns.include?(db_col.name)

      Column.create!(
        foundation_id: foundation.id,
        name: db_col.name.titleize,
        column_name: db_col.name,
        column_type: map_sql_type(db_col.sql_type),
        required: !db_col.null,
        is_title: %w[name title].include?(db_col.name),
        searchable: %w[name title email description].include?(db_col.name),
        position: index + 1
      )
    end
  end

  def map_sql_type(sql_type)
    case sql_type.downcase
    when /^character varying/, /^varchar/
      "single_line_text"
    when /^text/
      "multiple_lines_text"
    when /^integer/, /^bigint/, /^smallint/
      "whole_number"
    when /^numeric/, /^decimal/
      "currency"
    when /^double/, /^float/, /^real/
      "number"
    when /^boolean/
      "boolean"
    when /^date$/
      "date"
    when /^timestamp/, /^datetime/
      "date_and_time"
    when /^json/, /^jsonb/
      "multiple_lines_text"
    else
      "single_line_text"
    end
  end
end
