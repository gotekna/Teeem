# frozen_string_literal: true

# SmScheduleMasterCopyService - Copy templates and import rows between templates
#
# Handles creating template variants through copying and selective row imports.
# All copies create independent templates (no shared rows).
#
# Usage:
#   service = SmScheduleMasterCopyService.new(user: current_user)
#
#   # Copy entire template
#   result = service.copy_template(
#     source_template,
#     new_name: "Highset Build",
#     description: "Based on House Build with highset additions"
#   )
#
#   # Import rows from another template
#   result = service.import_rows(
#     source_template: source_template,
#     target_template: target_template,
#     row_ids: [1, 2, 3]  # Optional - if nil, imports all
#   )
#
class SmScheduleMasterCopyService
  attr_reader :user

  def initialize(user: nil)
    @user = user
  end

  # Copy an entire template to a new template
  def copy_template(source_template, new_name:, description: nil)
    return failure("Source template required") unless source_template.present?
    return failure("New name required") unless new_name.present?

    ActiveRecord::Base.transaction do
      # Create new template
      new_template = SmScheduleMasterTemplate.create!(
        name: new_name,
        description: description || "Copied from #{source_template.name}",
        copied_from_id: source_template.id,
        is_active: true,
        created_by: user,
        updated_by: user
      )

      # Copy all rows
      rows_copied = copy_rows_to_template(source_template, new_template)

      success(
        template: new_template,
        rows_copied: rows_copied,
        message: "Created '#{new_name}' with #{rows_copied} rows"
      )
    end
  rescue ActiveRecord::RecordInvalid => e
    failure("Failed to copy template: #{e.message}")
  end

  # Import specific rows from source template into target template
  # If row_ids is nil, imports all rows
  def import_rows(source_template:, target_template:, row_ids: nil)
    return failure("Source template required") unless source_template.present?
    return failure("Target template required") unless target_template.present?

    # Get source rows
    source_rows = if row_ids.present?
      source_template.sm_schedule_master_rows.where(id: row_ids)
    else
      source_template.sm_schedule_master_rows
    end

    return failure("No rows to import") if source_rows.empty?

    ActiveRecord::Base.transaction do
      # Get existing task numbers in target to avoid conflicts
      existing_task_numbers = target_template.sm_schedule_master_rows.pluck(:task_number)
      max_sequence = target_template.sm_schedule_master_rows.maximum(:sequence_order) || 0

      rows_imported = 0
      skipped_rows = []
      task_number_map = {} # Maps old task_number to new task_number

      source_rows.in_sequence.each do |source_row|
        # Determine new task number
        new_task_number = source_row.task_number
        if existing_task_numbers.include?(new_task_number)
          # Find next available
          new_task_number = (existing_task_numbers + task_number_map.values).max + 1
        end
        task_number_map[source_row.task_number] = new_task_number
        existing_task_numbers << new_task_number

        max_sequence += 1

        new_row = duplicate_row(source_row,
          template_id: target_template.id,
          task_number: new_task_number,
          sequence_order: max_sequence
        )

        if new_row.save
          rows_imported += 1
        else
          skipped_rows << { name: source_row.name, errors: new_row.errors.full_messages }
        end
      end

      # Remap predecessor IDs in imported rows
      remap_predecessors(target_template, task_number_map)

      success(
        rows_imported: rows_imported,
        skipped_rows: skipped_rows,
        message: "Imported #{rows_imported} rows"
      )
    end
  rescue ActiveRecord::RecordInvalid => e
    failure("Failed to import rows: #{e.message}")
  end

  private

  # Copy all rows from source template to target template
  def copy_rows_to_template(source_template, target_template)
    count = 0

    source_template.sm_schedule_master_rows.in_sequence.find_each do |source_row|
      new_row = duplicate_row(source_row, template_id: target_template.id)
      new_row.save!
      count += 1
    end

    count
  end

  # Duplicate a row with optional overrides
  def duplicate_row(source_row, template_id:, task_number: nil, sequence_order: nil)
    new_row = source_row.dup

    # Clear timestamps and IDs
    new_row.id = nil
    new_row.created_at = nil
    new_row.updated_at = nil

    # Set template ownership via sm_template_ids JSONB array
    new_row.sm_template_ids = [template_id]

    # Apply overrides
    new_row.task_number = task_number if task_number.present?
    new_row.sequence_order = sequence_order if sequence_order.present?

    # Set audit fields
    new_row.created_by = user
    new_row.updated_by = user

    new_row
  end

  # Remap predecessor IDs after import to point to new task numbers
  def remap_predecessors(template, task_number_map)
    return if task_number_map.empty?

    template.sm_schedule_master_rows.find_each do |row|
      next if row.predecessor_ids.blank?

      updated_preds = row.predecessor_ids.map do |pred|
        old_id = (pred["id"] || pred[:id]).to_i
        new_id = task_number_map[old_id]

        if new_id
          pred.merge("id" => new_id)
        else
          # Predecessor wasn't in our import - remove reference
          # Or keep if it's a valid task in the target template
          if template.sm_schedule_master_rows.exists?(task_number: old_id)
            pred
          else
            nil
          end
        end
      end.compact

      row.update_column(:predecessor_ids, updated_preds) if row.predecessor_ids != updated_preds
    end
  end

  def success(data = {})
    { success: true }.merge(data)
  end

  def failure(message)
    { success: false, error: message }
  end
end
