# frozen_string_literal: true

namespace :sm do
  desc "Migrate ScheduleTemplate data to SmTemplate (SSoT consolidation)"
  task migrate_templates: :environment do
    puts "=" * 60
    puts "SM Template Migration"
    puts "=" * 60
    puts ""

    # Check current state
    old_count = ScheduleTemplate.count
    new_count = SmTemplate.count
    old_row_count = ScheduleTemplateRow.count
    new_row_count = SmTemplateRow.count

    puts "Current State:"
    puts "  ScheduleTemplates: #{old_count}"
    puts "  SmTemplates: #{new_count}"
    puts "  ScheduleTemplateRows: #{old_row_count}"
    puts "  SmTemplateRows: #{new_row_count}"
    puts ""

    if old_count == 0
      puts "No ScheduleTemplates to migrate. Done!"
      next
    end

    if new_count > 0
      puts "WARNING: SmTemplates already exist. Migration may have already run."
      print "Continue anyway? (y/N): "
      response = STDIN.gets&.strip&.downcase
      unless response == "y"
        puts "Aborted."
        next
      end
    end

    puts ""
    puts "Migrating templates..."
    puts "-" * 40

    migrated_templates = 0
    migrated_rows = 0
    errors = []

    ActiveRecord::Base.transaction do
      ScheduleTemplate.find_each do |old_template|
        puts "Migrating: #{old_template.name}"

        # Create new SmTemplate
        new_template = SmTemplate.new(
          name: old_template.name,
          description: old_template.description,
          is_default: old_template.is_default,
          is_active: true,
          created_by_id: old_template.created_by_id
        )

        unless new_template.save
          errors << "Template '#{old_template.name}': #{new_template.errors.full_messages.join(', ')}"
          next
        end

        migrated_templates += 1

        # Migrate rows
        old_template.schedule_template_rows.in_sequence.each_with_index do |old_row, index|
          # Parse and convert arrays properly
          doc_cat_ids = Array(old_row.documentation_category_ids).map(&:to_i).reject(&:zero?)
          pb_item_ids = Array(old_row.price_book_item_ids).map(&:to_i).reject(&:zero?)
          linked_ids = old_row.linked_task_ids.is_a?(String) ? (JSON.parse(old_row.linked_task_ids) rescue []) : (old_row.linked_task_ids || [])

          # If auto-PO but no supplier, disable auto-PO (data fix)
          auto_po = old_row.create_po_on_job_start && old_row.supplier_id.present?

          new_row = SmTemplateRow.new(
            sm_template_id: new_template.id,
            name: old_row.name,
            task_number: index + 1,
            sequence_order: old_row.sequence_order,
            duration_days: [old_row.duration || 1, 1].max,
            start_day_offset: old_row.start_date || 0,

            # Dependencies
            predecessor_ids: old_row.predecessor_ids || [],

            # Categories
            trade: nil, # Old system didn't have trade field
            stage: nil, # Old system didn't have stage field

            # Supplier
            supplier_id: old_row.supplier_id,

            # Documentation
            documentation_category_ids: doc_cat_ids,
            show_in_docs_tab: false,
            linked_task_ids: linked_ids,

            # Requirements
            require_photo: old_row.require_photo || false,
            require_certificate: old_row.require_certificate || false,
            require_supervisor_check: old_row.require_supervisor_check || false,
            cert_lag_days: old_row.cert_lag_days || 0,

            # PO - disable auto-PO if no supplier (fixes validation)
            po_required: old_row.po_required || false,
            critical_po: old_row.critical_po || false,
            create_po_on_job_start: auto_po,

            # Subtasks
            has_subtasks: old_row.has_subtasks || false,
            subtask_count: old_row.subtask_count,
            subtask_names: old_row.subtask_names || [],

            # Other
            price_book_item_ids: pb_item_ids,
            tags: old_row.tags || [],
            is_active: true
          )

          if new_row.save
            migrated_rows += 1
          else
            errors << "Row '#{old_row.name}' in '#{old_template.name}': #{new_row.errors.full_messages.join(', ')}"
          end
        end

        puts "  -> Created #{new_template.sm_template_rows.count} rows"
      end

      if errors.any?
        puts ""
        puts "ERRORS encountered:"
        errors.each { |e| puts "  - #{e}" }
        puts ""
        puts "Rolling back transaction..."
        raise ActiveRecord::Rollback
      end
    end

    puts ""
    puts "=" * 60
    if errors.any?
      puts "MIGRATION FAILED"
      puts "Errors: #{errors.count}"
    else
      puts "MIGRATION COMPLETE"
      puts "Migrated: #{migrated_templates} templates, #{migrated_rows} rows"
    end
    puts "=" * 60
  end

  desc "Check migration status"
  task migration_status: :environment do
    puts "=" * 60
    puts "SM Template Migration Status"
    puts "=" * 60
    puts ""
    puts "OLD System (ScheduleTemplate):"
    puts "  Templates: #{ScheduleTemplate.count}"
    puts "  Rows: #{ScheduleTemplateRow.count}"
    puts ""
    puts "NEW System (SmTemplate):"
    puts "  Templates: #{SmTemplate.count}"
    puts "  Rows: #{SmTemplateRow.count}"
    puts ""

    if SmTemplate.count > 0 && ScheduleTemplate.count > 0
      puts "Status: DUAL SYSTEM (migration in progress)"
      puts ""
      puts "Recommendations:"
      puts "  1. Verify SmTemplate data is correct"
      puts "  2. Update frontend to use SmTemplate API"
      puts "  3. Run sm:deprecate_old_templates when ready"
    elsif SmTemplate.count > 0
      puts "Status: MIGRATED (SmTemplate is SSoT)"
    else
      puts "Status: NOT MIGRATED (ScheduleTemplate is active)"
      puts ""
      puts "Run: rails sm:migrate_templates"
    end
  end
end
