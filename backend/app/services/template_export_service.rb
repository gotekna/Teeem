# frozen_string_literal: true

# Service to export tenant configuration as a TemplatePack
#
# Usage:
#   # Export full configuration pack
#   service = TemplateExportService.new(tenant)
#   pack = service.export_full_pack(name: "Tekna Config 2026", visibility: :curated)
#
#   # Export specific item types only
#   pack = service.export_selective(
#     name: "Schedule Templates Only",
#     item_types: [:sm_schedule_master_templates]
#   )
#
class TemplateExportService
  # All exportable configuration types
  EXPORTABLE_TYPES = %i[
    job_types
    job_statuses
    job_stages
    contact_types
    document_types
    sm_schedule_master_templates
    public_holidays
    warehouse_folders
  ].freeze

  def initialize(tenant, created_by: nil)
    @tenant = tenant
    @created_by = created_by
  end

  # Export all configuration as a template pack
  def export_full_pack(name:, description: nil, visibility: :private_pack)
    pack = create_pack(name: name, description: description, visibility: visibility)

    EXPORTABLE_TYPES.each_with_index do |item_type, index|
      export_item_type(pack, item_type, position: index)
    end

    pack.update!(status: :published)
    pack
  end

  # Export only specific item types
  def export_selective(name:, item_types:, description: nil, visibility: :private_pack)
    # Validate item types
    invalid_types = item_types - EXPORTABLE_TYPES
    raise ArgumentError, "Invalid item types: #{invalid_types.join(', ')}" if invalid_types.any?

    pack = create_pack(name: name, description: description, visibility: visibility)

    item_types.each_with_index do |item_type, index|
      export_item_type(pack, item_type, position: index)
    end

    pack.update!(status: :published)
    pack
  end

  # Export just schedule master templates (common use case)
  def export_schedule_master_only(name:, description: nil)
    export_selective(
      name: name,
      description: description || "Schedule Master templates from #{@tenant.name}",
      item_types: [:sm_schedule_master_templates]
    )
  end

  private

  def create_pack(name:, description:, visibility:)
    TemplatePack.create!(
      source_tenant: @tenant,
      created_by: @created_by,
      name: name,
      description: description || "Configuration exported from #{@tenant.name}",
      visibility: visibility,
      status: :draft,
      version: "1.0"
    )
  end

  def export_item_type(pack, item_type, position:)
    data = send("export_#{item_type}")
    return if data.empty?

    pack.template_pack_items.create!(
      item_type: item_type.to_s,
      data: data,
      position: position
    )
  end

  # =========================================================================
  # Export methods for each configuration type
  # =========================================================================

  def export_job_types
    @tenant.job_types.order(:position, :name).map do |record|
      {
        name: record.name,
        code: record.code,
        description: record.description,
        color: record.color,
        icon: record.icon,
        position: record.position,
        is_active: record.is_active
      }.compact
    end
  end

  def export_job_statuses
    @tenant.job_statuses.order(:position, :name).map do |record|
      {
        name: record.name,
        code: record.code,
        color: record.color,
        position: record.position,
        is_active: record.respond_to?(:is_active) ? record.is_active : true
      }.compact
    end
  end

  def export_job_stages
    @tenant.job_stages.order(:position, :name).map do |record|
      {
        name: record.name,
        code: record.code,
        description: record.description,
        position: record.position,
        is_active: record.respond_to?(:is_active) ? record.is_active : true
      }.compact
    end
  end

  def export_contact_types
    @tenant.contact_types.order(:name).map do |record|
      {
        name: record.name,
        code: record.code,
        description: record.description,
        is_active: record.respond_to?(:is_active) ? record.is_active : true
      }.compact
    end
  end

  def export_document_types
    @tenant.document_types.order(:scope, :name).map do |record|
      {
        name: record.name,
        scope: record.scope,
        display_name: record.display_name,
        file_name_template: record.respond_to?(:file_name) ? record.file_name : nil,
        description: record.description,
        is_active: record.respond_to?(:is_active) ? record.is_active : true
      }.compact
    end
  end

  def export_sm_schedule_master_templates
    templates = @tenant.sm_schedule_master_templates.includes(:sm_tasks).order(:name)

    templates.map do |template|
      {
        name: template.name,
        description: template.description,
        is_default: template.is_default,
        tasks: export_template_tasks(template)
      }.compact
    end
  end

  def export_template_tasks(template)
    # Get tasks associated with this template
    tasks = template.sm_tasks.order(:position)

    tasks.map do |task|
      {
        name: task.name,
        description: task.description,
        position: task.position,
        duration_days: task.duration_days,
        trade_type: task.respond_to?(:trade_type) ? task.trade_type : nil,
        trade_name: task.respond_to?(:trade_name) ? task.trade_name : nil,
        is_milestone: task.respond_to?(:is_milestone) ? task.is_milestone : false,
        color: task.respond_to?(:color) ? task.color : nil,
        dependencies: export_task_dependencies(task)
      }.compact
    end
  end

  def export_task_dependencies(task)
    return [] unless task.respond_to?(:dependencies) && task.dependencies.present?

    # Dependencies are stored as task IDs - convert to positions for portability
    task.dependencies
  end

  def export_public_holidays
    @tenant.public_holidays.order(:date).map do |record|
      {
        name: record.name,
        date: record.date&.to_s,
        state: record.state,
        recurring: record.respond_to?(:recurring) ? record.recurring : false
      }.compact
    end
  end

  # SSoT (Feb 2026): Export from warehouse_folders
  def export_warehouse_folders
    @tenant.warehouse_folders.includes(:warehouse_type).order(:order_position).map do |record|
      {
        entity_type: record.warehouse_type_code,
        name: record.display_name || record.name,
        slug: record.tab_key,
        icon: record.icon_name,
        position: record.order_position,
        is_visible: record.enabled,
        requires_permission: record.visibility_rule
      }.compact
    end
  end
end
