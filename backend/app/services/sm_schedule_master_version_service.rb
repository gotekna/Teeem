# frozen_string_literal: true

# SmScheduleMasterVersionService - Manage template versions
#
# Handles creating, publishing, and archiving template versions.
# Ensures only one draft and one published version per template.
#
# Usage:
#   service = SmScheduleMasterVersionService.new(template, user: current_user)
#
#   # Create a new draft (copies rows from published version)
#   result = service.create_draft
#
#   # Publish the draft
#   result = service.publish_draft(change_summary: "Added scaffold tasks")
#
#   # Discard the draft
#   result = service.discard_draft
#
class SmScheduleMasterVersionService
  attr_reader :template, :user

  def initialize(template, user: nil)
    @template = template
    @user = user
  end

  # Create a new draft version
  # Copies rows from the current published version (if exists)
  def create_draft
    return failure("Draft already exists") if template.draft_version.present?

    ActiveRecord::Base.transaction do
      draft = template.sm_schedule_master_versions.create!(
        status: 'draft',
        change_summary: nil
      )

      # Copy rows from published version
      if template.published_version.present?
        copy_rows(from: template.published_version, to: draft)
      end

      success(
        version: draft,
        message: "Draft version #{draft.version_number} created",
        rows_copied: draft.row_count
      )
    end
  rescue ActiveRecord::RecordInvalid => e
    failure("Failed to create draft: #{e.message}")
  end

  # Publish the current draft
  # Archives the previous published version
  def publish_draft(change_summary: nil)
    draft = template.draft_version
    return failure("No draft to publish") unless draft.present?
    return failure("Draft has no rows") if draft.row_count.zero?

    ActiveRecord::Base.transaction do
      # Archive current published version
      if template.published_version.present?
        template.published_version.update!(status: 'archived')
      end

      # Publish the draft
      draft.update!(
        status: 'published',
        published_at: Time.current,
        published_by: user,
        change_summary: change_summary
      )

      success(
        version: draft,
        message: "Version #{draft.version_number} published",
        row_count: draft.row_count
      )
    end
  rescue ActiveRecord::RecordInvalid => e
    failure("Failed to publish: #{e.message}")
  end

  # Discard the current draft (delete it and its rows)
  def discard_draft
    draft = template.draft_version
    return failure("No draft to discard") unless draft.present?

    ActiveRecord::Base.transaction do
      row_count = draft.row_count
      draft.destroy!

      success(
        message: "Draft discarded",
        rows_deleted: row_count
      )
    end
  rescue ActiveRecord::RecordInvalid => e
    failure("Failed to discard draft: #{e.message}")
  end

  # Get version history for the template
  def version_history
    template.sm_schedule_master_versions
            .by_version
            .includes(:published_by)
            .map do |v|
      {
        id: v.id,
        version_number: v.version_number,
        status: v.status,
        published_at: v.published_at,
        published_by: v.published_by&.name,
        change_summary: v.change_summary,
        row_count: v.row_count,
        jobs_using: v.jobs.count
      }
    end
  end

  # Compare two versions and return differences
  def compare_versions(version_a, version_b)
    rows_a = version_a.sm_schedule_master_rows.index_by(&:task_number)
    rows_b = version_b.sm_schedule_master_rows.index_by(&:task_number)

    all_task_numbers = (rows_a.keys + rows_b.keys).uniq.sort

    differences = []

    all_task_numbers.each do |task_number|
      row_a = rows_a[task_number]
      row_b = rows_b[task_number]

      if row_a.nil?
        differences << {
          task_number: task_number,
          type: :added,
          name: row_b.name,
          details: "Added in v#{version_b.version_number}"
        }
      elsif row_b.nil?
        differences << {
          task_number: task_number,
          type: :removed,
          name: row_a.name,
          details: "Removed in v#{version_b.version_number}"
        }
      else
        field_changes = compare_row_fields(row_a, row_b)
        if field_changes.any?
          differences << {
            task_number: task_number,
            type: :changed,
            name: row_b.name,
            changes: field_changes
          }
        end
      end
    end

    {
      version_a: { number: version_a.version_number, status: version_a.status },
      version_b: { number: version_b.version_number, status: version_b.status },
      summary: {
        added: differences.count { |d| d[:type] == :added },
        removed: differences.count { |d| d[:type] == :removed },
        changed: differences.count { |d| d[:type] == :changed }
      },
      differences: differences
    }
  end

  private

  def copy_rows(from:, to:)
    from.sm_schedule_master_rows.find_each do |row|
      new_row = row.dup
      new_row.sm_schedule_master_version_id = to.id
      new_row.created_at = nil
      new_row.updated_at = nil
      new_row.save!
    end
  end

  # Fields to compare between rows
  COMPARABLE_FIELDS = %i[
    name description duration_days trade stage
    predecessor_ids linked_task_ids
    po_required critical_po create_po_on_job_start
    require_photo checklist_id
    order_time_days call_time_days
    spawn_order_task spawn_call_task
    pass_fail_enabled assigned_role
    is_active
  ].freeze

  def compare_row_fields(row_a, row_b)
    changes = []

    COMPARABLE_FIELDS.each do |field|
      val_a = row_a.send(field)
      val_b = row_b.send(field)

      next if val_a == val_b

      changes << {
        field: field,
        from: val_a,
        to: val_b
      }
    end

    changes
  end

  def success(data = {})
    { success: true }.merge(data)
  end

  def failure(message)
    { success: false, error: message }
  end
end
