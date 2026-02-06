# frozen_string_literal: true

# Service to import a TemplatePack into a tenant
#
# Usage:
#   # Import all items from a pack
#   service = TemplateImportService.new(tenant, template_pack)
#   result = service.import!
#   # => { success: true, imported: { job_types: 5, job_statuses: 3, ... }, errors: [] }
#
#   # Import with options
#   result = service.import!(
#     skip_existing: true,      # Don't update existing records (default: false)
#     item_types: [:job_types]  # Only import specific types (default: all)
#   )
#
class TemplateImportService
  attr_reader :errors, :imported_counts

  def initialize(tenant, template_pack)
    @tenant = tenant
    @pack = template_pack
    @errors = []
    @imported_counts = {}
    @skip_existing = false
    @item_types_filter = nil
  end

  # Import template pack into tenant
  def import!(skip_existing: false, item_types: nil)
    @skip_existing = skip_existing
    @item_types_filter = item_types&.map(&:to_s)

    ActsAsTenant.with_tenant(@tenant) do
      ActiveRecord::Base.transaction do
        @pack.template_pack_items.order(:position).each do |item|
          next if @item_types_filter && !@item_types_filter.include?(item.item_type)

          import_item(item)
        end

        # Rollback if any errors
        raise ActiveRecord::Rollback if @errors.any?
      end
    end

    # Update download count on success
    @pack.increment!(:downloads_count) if @errors.empty?

    {
      success: @errors.empty?,
      imported: @imported_counts,
      errors: @errors
    }
  end

  # Validate without actually importing (dry run)
  def validate!
    @errors = []
    @imported_counts = {}

    @pack.template_pack_items.order(:position).each do |item|
      validate_item(item)
    end

    {
      valid: @errors.empty?,
      would_import: @imported_counts,
      errors: @errors
    }
  end

  private

  def import_item(item)
    method_name = "import_#{item.item_type}"

    unless respond_to?(method_name, true)
      @errors << "Unknown item type: #{item.item_type}"
      return
    end

    send(method_name, item.data)
  rescue StandardError => e
    @errors << "Error importing #{item.item_type}: #{e.message}"
    Rails.logger.error "[TemplateImportService] #{e.message}\n#{e.backtrace.first(5).join("\n")}"
  end

  def validate_item(item)
    # Count how many records would be created/updated
    count = item.data.is_a?(Array) ? item.data.length : 1
    @imported_counts[item.item_type.to_sym] = count
  end

  # =========================================================================
  # Import methods for each configuration type
  # =========================================================================

  def import_job_types(data)
    count = 0
    data.each do |attrs|
      record = JobType.find_or_initialize_by(name: attrs["name"])

      if record.persisted? && @skip_existing
        next
      end

      record.assign_attributes(
        code: attrs["code"],
        description: attrs["description"],
        color: attrs["color"],
        icon: attrs["icon"],
        position: attrs["position"],
        is_active: attrs.fetch("is_active", true)
      )

      if record.save
        count += 1
      else
        @errors << "JobType '#{attrs['name']}': #{record.errors.full_messages.join(', ')}"
      end
    end
    @imported_counts[:job_types] = count
  end

  def import_job_statuses(data)
    count = 0
    data.each do |attrs|
      record = JobStatus.find_or_initialize_by(name: attrs["name"])

      if record.persisted? && @skip_existing
        next
      end

      record.assign_attributes(
        code: attrs["code"],
        color: attrs["color"],
        position: attrs["position"]
      )
      record.is_active = attrs.fetch("is_active", true) if record.respond_to?(:is_active=)

      if record.save
        count += 1
      else
        @errors << "JobStatus '#{attrs['name']}': #{record.errors.full_messages.join(', ')}"
      end
    end
    @imported_counts[:job_statuses] = count
  end

  def import_job_stages(data)
    count = 0
    data.each do |attrs|
      record = JobStage.find_or_initialize_by(name: attrs["name"])

      if record.persisted? && @skip_existing
        next
      end

      record.assign_attributes(
        code: attrs["code"],
        description: attrs["description"],
        position: attrs["position"]
      )
      record.is_active = attrs.fetch("is_active", true) if record.respond_to?(:is_active=)

      if record.save
        count += 1
      else
        @errors << "JobStage '#{attrs['name']}': #{record.errors.full_messages.join(', ')}"
      end
    end
    @imported_counts[:job_stages] = count
  end

  def import_contact_types(data)
    count = 0
    data.each do |attrs|
      record = ContactType.find_or_initialize_by(name: attrs["name"])

      if record.persisted? && @skip_existing
        next
      end

      record.assign_attributes(
        code: attrs["code"],
        description: attrs["description"]
      )
      record.is_active = attrs.fetch("is_active", true) if record.respond_to?(:is_active=)

      if record.save
        count += 1
      else
        @errors << "ContactType '#{attrs['name']}': #{record.errors.full_messages.join(', ')}"
      end
    end
    @imported_counts[:contact_types] = count
  end

  def import_document_types(data)
    count = 0
    data.each do |attrs|
      record = DocumentType.find_or_initialize_by(name: attrs["name"], scope: attrs["scope"])

      if record.persisted? && @skip_existing
        next
      end

      record.assign_attributes(
        display_name: attrs["display_name"],
        description: attrs["description"]
      )
      record.file_name = attrs["file_name_template"] if record.respond_to?(:file_name=) && attrs["file_name_template"]
      record.is_active = attrs.fetch("is_active", true) if record.respond_to?(:is_active=)

      if record.save
        count += 1
      else
        @errors << "DocumentType '#{attrs['name']}' (#{attrs['scope']}): #{record.errors.full_messages.join(', ')}"
      end
    end
    @imported_counts[:document_types] = count
  end

  def import_sm_schedule_master_templates(data)
    count = 0
    data.each do |attrs|
      template = SmScheduleMasterTemplate.find_or_initialize_by(name: attrs["name"])

      if template.persisted? && @skip_existing
        next
      end

      template.assign_attributes(
        description: attrs["description"],
        is_default: attrs.fetch("is_default", false)
      )

      if template.save
        # Import tasks for this template
        import_template_tasks(template, attrs["tasks"] || [])
        count += 1
      else
        @errors << "SmScheduleMasterTemplate '#{attrs['name']}': #{template.errors.full_messages.join(', ')}"
      end
    end
    @imported_counts[:sm_schedule_master_templates] = count
  end

  def import_template_tasks(template, tasks_data)
    # Clear existing tasks if updating
    template.sm_tasks.destroy_all unless @skip_existing

    tasks_data.each do |task_attrs|
      task = template.sm_tasks.build(
        name: task_attrs["name"],
        description: task_attrs["description"],
        position: task_attrs["position"],
        duration_days: task_attrs["duration_days"]
      )

      task.trade_type = task_attrs["trade_type"] if task.respond_to?(:trade_type=)
      task.trade_name = task_attrs["trade_name"] if task.respond_to?(:trade_name=)
      task.is_milestone = task_attrs.fetch("is_milestone", false) if task.respond_to?(:is_milestone=)
      task.color = task_attrs["color"] if task.respond_to?(:color=)

      unless task.save
        @errors << "Task '#{task_attrs['name']}' in template '#{template.name}': #{task.errors.full_messages.join(', ')}"
      end
    end
  end

  def import_public_holidays(data)
    count = 0
    data.each do |attrs|
      # Parse date from string
      date = attrs["date"].present? ? Date.parse(attrs["date"]) : nil
      next unless date

      record = PublicHoliday.find_or_initialize_by(name: attrs["name"], date: date)

      if record.persisted? && @skip_existing
        next
      end

      record.assign_attributes(
        state: attrs["state"]
      )
      record.recurring = attrs.fetch("recurring", false) if record.respond_to?(:recurring=)

      if record.save
        count += 1
      else
        @errors << "PublicHoliday '#{attrs['name']}': #{record.errors.full_messages.join(', ')}"
      end
    end
    @imported_counts[:public_holidays] = count
  end

  # SSoT (Feb 2026): Import into BaseFolder (was WarehouseFolder)
  def import_warehouse_folders(data)
    count = 0
    data.each do |attrs|
      # Map entity_type to warehouse_type_id
      wt = WarehouseType.find_by(code: attrs["entity_type"]) if attrs["entity_type"].present?

      record = BaseFolder.find_or_initialize_by(
        warehouse_type_id: wt&.id,
        tab_key: attrs["slug"]
      )

      if record.persisted? && @skip_existing
        next
      end

      record.assign_attributes(
        name: attrs["name"],
        display_name: attrs["name"],
        icon_name: attrs["icon"],
        order_position: attrs["position"]
      )
      record.hidden_by_default = !attrs.fetch("is_visible", true) if record.respond_to?(:hidden_by_default=)

      if record.save
        count += 1
      else
        @errors << "WarehouseFolder '#{attrs['name']}' (#{attrs['entity_type']}): #{record.errors.full_messages.join(', ')}"
      end
    end
    @imported_counts[:warehouse_folders] = count
  end
end
