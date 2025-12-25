namespace :setup do
  desc "Deploy setup data (documentation categories, supervisor checklists, schedule templates) to staging/production"
  task deploy_setup_data: :environment do
    require "csv"

    puts "\n" + "="*60
    puts "DEPLOYING SETUP DATA"
    puts "="*60

    # Use CSV files from db/import_data
    users_file = Rails.root.join("db", "import_data", "users.csv")
    doc_categories_file = Rails.root.join("db", "import_data", "documentation_categories.csv")
    checklist_templates_file = Rails.root.join("db", "import_data", "supervisor_checklist_templates.csv")
    schedule_templates_file = Rails.root.join("db", "import_data", "schedule_templates.csv")
    schedule_rows_file = Rails.root.join("db", "import_data", "schedule_template_rows.csv")

    # Step 1: Clear existing data
    puts "\nStep 1: Clearing existing setup data..."

    deleted_rows = ScheduleTemplateRow.count
    ScheduleTemplateRow.delete_all
    puts "  ✓ Deleted #{deleted_rows} schedule template rows"

    deleted_templates = ScheduleTemplate.count
    ScheduleTemplate.delete_all
    puts "  ✓ Deleted #{deleted_templates} schedule templates"

    deleted_checklists = SupervisorChecklistTemplate.count
    SupervisorChecklistTemplate.delete_all
    puts "  ✓ Deleted #{deleted_checklists} supervisor checklist templates"

    deleted_categories = DocumentationCategory.count
    DocumentationCategory.delete_all
    puts "  ✓ Deleted #{deleted_categories} documentation categories"

    puts "  ⚠ Skipping user deletion (users may be referenced by projects/other records)"

    # Step 2: Update/Create Users
    if File.exist?(users_file)
      puts "\nStep 2: Updating/creating users..."
      user_count = 0
      updated_count = 0

      CSV.foreach(users_file, headers: true, header_converters: :symbol) do |row|
        user = User.find_or_initialize_by(email: row[:email])

        if user.new_record?
          user.name = row[:name]
          user.password = row[:password] || "changeme123"
          user.role = row[:role] || "user"
          user.save!
          user_count += 1
        else
          user.update!(
            name: row[:name],
            role: row[:role] || "user"
          )
          updated_count += 1
        end
      end

      puts "  ✓ Created #{user_count} new users, updated #{updated_count} existing users"
    else
      puts "\n⚠ Users file not found at #{users_file}"
    end

    # Step 3: Import Documentation Categories
    if File.exist?(doc_categories_file)
      puts "\nStep 2: Importing documentation categories..."
      category_count = 0

      CSV.foreach(doc_categories_file, headers: true, header_converters: :symbol) do |row|
        DocumentationCategory.create!(
          name: row[:name],
          icon: row[:icon],
          color: row[:color],
          description: row[:description],
          sequence_order: row[:sequence_order].to_i,
          is_active: row[:is_active] == "true"
        )
        category_count += 1
      end

      puts "  ✓ Imported #{category_count} documentation categories"
    else
      puts "\n⚠ Documentation categories file not found at #{doc_categories_file}"
    end

    # Step 4: Import Supervisor Checklist Templates
    if File.exist?(checklist_templates_file)
      puts "\nStep 3: Importing supervisor checklist templates..."
      checklist_count = 0

      CSV.foreach(checklist_templates_file, headers: true, header_converters: :symbol) do |row|
        SupervisorChecklistTemplate.create!(
          name: row[:name],
          description: row[:description],
          category: row[:category],
          response_type: row[:response_type] || "checkbox",
          sequence_order: row[:sequence_order].to_i,
          is_active: row[:is_active] == "true"
        )
        checklist_count += 1
      end

      puts "  ✓ Imported #{checklist_count} supervisor checklist templates"
    else
      puts "\n⚠ Supervisor checklist templates file not found at #{checklist_templates_file}"
    end

    # Step 5: Import Schedule Templates
    template_map = {}
    if File.exist?(schedule_templates_file)
      puts "\nStep 4: Importing schedule templates..."
      template_count = 0

      # Get first user as creator (or create a system user)
      creator = User.first || User.create!(
        email: "system@teeem.com",
        name: "System",
        password: SecureRandom.hex(20)
      )

      CSV.foreach(schedule_templates_file, headers: true, header_converters: :symbol) do |row|
        template = ScheduleTemplate.create!(
          name: row[:name],
          description: row[:description],
          is_default: row[:is_default] == "true",
          created_by: creator
        )
        # Map old ID to new ID for linking rows
        template_map[row[:id].to_i] = template.id
        template_count += 1
      end

      puts "  ✓ Imported #{template_count} schedule templates"
    else
      puts "\n⚠ Schedule templates file not found at #{schedule_templates_file}"
    end

    # Step 6: Import Schedule Template Rows
    if File.exist?(schedule_rows_file)
      puts "\nStep 5: Importing schedule template rows..."
      row_count = 0

      CSV.foreach(schedule_rows_file, headers: true, header_converters: :symbol) do |row|
        template_id = template_map[row[:schedule_template_id].to_i]

        unless template_id
          puts "  ⚠ Skipping row '#{row[:name]}' - template not found"
          next
        end

        # Parse array fields
        predecessor_ids = row[:predecessor_ids].present? ? JSON.parse(row[:predecessor_ids]) : []
        price_book_item_ids = row[:price_book_item_ids].present? ? JSON.parse(row[:price_book_item_ids]) : []
        documentation_category_ids = row[:documentation_category_ids].present? ? JSON.parse(row[:documentation_category_ids]) : []
        supervisor_checklist_template_ids = row[:supervisor_checklist_template_ids].present? ? JSON.parse(row[:supervisor_checklist_template_ids]) : []
        tags = row[:tags].present? ? JSON.parse(row[:tags]) : []
        subtask_names = row[:subtask_names].present? ? JSON.parse(row[:subtask_names]) : []
        linked_task_ids = row[:linked_task_ids].present? ? JSON.parse(row[:linked_task_ids]) : []

        # Build attributes hash
        attributes = {
          schedule_template_id: template_id,
          name: row[:name],
          supplier_id: row[:supplier_id].present? ? row[:supplier_id].to_i : nil,
          assigned_user_id: row[:assigned_user_id].present? ? row[:assigned_user_id].to_i : nil,
          predecessor_ids: predecessor_ids,
          po_required: row[:po_required] == "true",
          create_po_on_job_start: row[:create_po_on_job_start] == "true",
          critical_po: row[:critical_po] == "true",
          price_book_item_ids: price_book_item_ids,
          documentation_category_ids: documentation_category_ids,
          tags: tags,
          require_photo: row[:require_photo] == "true",
          require_certificate: row[:require_certificate] == "true",
          cert_lag_days: row[:cert_lag_days].present? ? row[:cert_lag_days].to_i : nil,
          confirm: row[:confirm] == "true",
          auto_complete_predecessors: row[:auto_complete_predecessors] == "true",
          has_subtasks: row[:has_subtasks] == "true",
          subtask_count: row[:subtask_count].present? ? row[:subtask_count].to_i : nil,
          subtask_names: subtask_names,
          sequence_order: row[:sequence_order].to_i,
          linked_task_ids: linked_task_ids,
          linked_template_id: row[:linked_template_id].present? ? row[:linked_template_id].to_i : nil
        }

        # Only add supervisor_checklist_template_ids if column exists
        if ScheduleTemplateRow.column_names.include?("supervisor_checklist_template_ids")
          attributes[:supervisor_checklist_template_ids] = supervisor_checklist_template_ids
        end

        ScheduleTemplateRow.create!(attributes)
        row_count += 1
      end

      puts "  ✓ Imported #{row_count} schedule template rows"
    else
      puts "\n⚠ Schedule template rows file not found at #{schedule_rows_file}"
    end

    # Summary
    puts "\n" + "="*60
    puts "DEPLOYMENT COMPLETE"
    puts "="*60
    puts "Users: #{User.count}"
    puts "Documentation Categories: #{DocumentationCategory.count}"
    puts "Supervisor Checklist Templates: #{SupervisorChecklistTemplate.count}"
    puts "Schedule Templates: #{ScheduleTemplate.count}"
    puts "Schedule Template Rows: #{ScheduleTemplateRow.count}"
    puts "\nSetup data successfully deployed!"
  end

  desc "Export setup data to CSV files for deployment"
  task export_setup_data: :environment do
    require "csv"

    puts "\n" + "="*60
    puts "EXPORTING SETUP DATA TO CSV"
    puts "="*60

    # Create import_data directory if it doesn't exist
    import_dir = Rails.root.join("db", "import_data")
    FileUtils.mkdir_p(import_dir)

    # Export Users
    puts "\nExporting users..."
    users_file = import_dir.join("users.csv")
    CSV.open(users_file, "w") do |csv|
      csv << [ "email", "name", "role", "password" ]
      User.all.each do |user|
        csv << [
          user.email,
          user.name,
          user.role,
          "changeme123"  # Default password - users should reset on first login
        ]
      end
    end
    puts "  ✓ Exported #{User.count} users to #{users_file}"

    # Export Documentation Categories
    puts "\nExporting documentation categories..."
    doc_categories_file = import_dir.join("documentation_categories.csv")
    CSV.open(doc_categories_file, "w") do |csv|
      csv << [ "name", "icon", "color", "description", "sequence_order", "is_active" ]
      DocumentationCategory.order(:sequence_order).each do |cat|
        csv << [
          cat.name,
          cat.icon,
          cat.color,
          cat.description,
          cat.sequence_order,
          cat.is_active
        ]
      end
    end
    puts "  ✓ Exported #{DocumentationCategory.count} categories to #{doc_categories_file}"

    # Export Supervisor Checklist Templates
    puts "\nExporting supervisor checklist templates..."
    checklist_file = import_dir.join("supervisor_checklist_templates.csv")
    CSV.open(checklist_file, "w") do |csv|
      csv << [ "name", "description", "category", "response_type", "sequence_order", "is_active" ]
      SupervisorChecklistTemplate.order(:sequence_order).each do |template|
        csv << [
          template.name,
          template.description,
          template.category,
          template.response_type,
          template.sequence_order,
          template.is_active
        ]
      end
    end
    puts "  ✓ Exported #{SupervisorChecklistTemplate.count} checklist templates to #{checklist_file}"

    # Export Schedule Templates
    puts "\nExporting schedule templates..."
    templates_file = import_dir.join("schedule_templates.csv")
    CSV.open(templates_file, "w") do |csv|
      csv << [ "id", "name", "description", "is_default" ]
      ScheduleTemplate.all.each do |template|
        csv << [
          template.id,
          template.name,
          template.description,
          template.is_default
        ]
      end
    end
    puts "  ✓ Exported #{ScheduleTemplate.count} templates to #{templates_file}"

    # Export Schedule Template Rows
    puts "\nExporting schedule template rows..."
    rows_file = import_dir.join("schedule_template_rows.csv")

    # Check which columns exist
    has_supervisor_checklist = ScheduleTemplateRow.column_names.include?("supervisor_checklist_template_ids")

    CSV.open(rows_file, "w") do |csv|
      headers = [
        "schedule_template_id", "name", "supplier_id", "assigned_user_id",
        "predecessor_ids", "po_required", "create_po_on_job_start", "critical_po",
        "price_book_item_ids", "documentation_category_ids",
        "tags", "require_photo", "require_certificate", "cert_lag_days",
        "confirm", "auto_complete_predecessors",
        "has_subtasks", "subtask_count", "subtask_names", "sequence_order",
        "linked_task_ids", "linked_template_id"
      ]
      headers.insert(10, "supervisor_checklist_template_ids") if has_supervisor_checklist
      csv << headers

      ScheduleTemplateRow.order(:sequence_order).each do |row|
        data = [
          row.schedule_template_id,
          row.name,
          row.supplier_id,
          row.assigned_user_id,
          row.predecessor_ids.to_json,
          row.po_required,
          row.create_po_on_job_start,
          row.critical_po,
          row.price_book_item_ids.to_json,
          row.documentation_category_ids.to_json,
          row.tags.to_json,
          row.require_photo,
          row.require_certificate,
          row.cert_lag_days,
          row.confirm,
          row.auto_complete_predecessors,
          row.has_subtasks,
          row.subtask_count,
          row.subtask_names.to_json,
          row.sequence_order,
          row.linked_task_ids.to_json,
          row.linked_template_id
        ]
        data.insert(10, (row.respond_to?(:supervisor_checklist_template_ids) ? row.supervisor_checklist_template_ids.to_json : [].to_json)) if has_supervisor_checklist
        csv << data
      end
    end
    puts "  ✓ Exported #{ScheduleTemplateRow.count} rows to #{rows_file}"

    # Export Folder Templates
    puts "\nExporting folder templates..."
    folder_templates_file = import_dir.join("folder_templates.csv")
    CSV.open(folder_templates_file, "w") do |csv|
      csv << [ "id", "name", "template_type", "is_system_default", "is_active" ]
      FolderTemplate.all.each do |template|
        csv << [
          template.id,
          template.name,
          template.template_type,
          template.is_system_default,
          template.is_active
        ]
      end
    end
    puts "  ✓ Exported #{FolderTemplate.count} folder templates to #{folder_templates_file}"

    # Export Folder Template Items
    puts "\nExporting folder template items..."
    folder_items_file = import_dir.join("folder_template_items.csv")
    CSV.open(folder_items_file, "w") do |csv|
      csv << [ "id", "folder_template_id", "name", "level", "order", "parent_id", "description" ]
      FolderTemplateItem.order(:order).each do |item|
        csv << [
          item.id,
          item.folder_template_id,
          item.name,
          item.level,
          item.order,
          item.parent_id,
          item.description
        ]
      end
    end
    puts "  ✓ Exported #{FolderTemplateItem.count} folder template items to #{folder_items_file}"

    # Summary
    puts "\n" + "="*60
    puts "EXPORT COMPLETE"
    puts "="*60
    puts "Files created in: #{import_dir}"
    puts "Users: #{User.count}"
    puts "Documentation Categories: #{DocumentationCategory.count}"
    puts "Supervisor Checklist Templates: #{SupervisorChecklistTemplate.count}"
    puts "Schedule Templates: #{ScheduleTemplate.count}"
    puts "Schedule Template Rows: #{ScheduleTemplateRow.count}"
    puts "Folder Templates: #{FolderTemplate.count}"
    puts "Folder Template Items: #{FolderTemplateItem.count}"
    puts "\nTo deploy to staging/production:"
    puts "1. Commit and push the CSV files to git"
    puts "2. On the target environment, run: rails setup:deploy_setup_data"
  end
end
