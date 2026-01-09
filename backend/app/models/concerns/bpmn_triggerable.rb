# Add to any model to enable BPMN workflow triggers
#
# Usage in model:
#   include BpmnTriggerable
#   bpmn_status_trigger :status          # fires on 'status' field changes
#   bpmn_status_trigger :job_status_id   # fires on 'job_status_id' changes
#   bpmn_field_triggers :price, :amount  # fires on any of these field changes
#
module BpmnTriggerable
  extend ActiveSupport::Concern

  included do
    class_attribute :_bpmn_status_fields, default: []
    class_attribute :_bpmn_field_triggers, default: []

    after_update :fire_bpmn_status_triggers
    after_update :fire_bpmn_field_triggers
  end

  class_methods do
    # Register a field as a status trigger
    def bpmn_status_trigger(field_name)
      self._bpmn_status_fields = _bpmn_status_fields + [ field_name.to_s ]
    end

    # Register fields for field change triggers
    def bpmn_field_triggers(*field_names)
      self._bpmn_field_triggers = _bpmn_field_triggers + field_names.map(&:to_s)
    end
  end

  private

  def fire_bpmn_status_triggers
    return if _bpmn_status_fields.empty?

    _bpmn_status_fields.each do |field_name|
      next unless saved_change_to_attribute?(field_name)

      old_value, new_value = saved_change_to_attribute(field_name)

      # Resolve to names if this is an association (e.g., job_status_id -> job_status.name)
      old_display = resolve_status_display(field_name, old_value)
      new_display = resolve_status_display(field_name, new_value)

      Bpmn::TriggerFiringService.fire_status_change(
        entity: self,
        field_name: normalize_field_name(field_name),
        old_value: old_display,
        new_value: new_display
      )
    end
  rescue StandardError => e
    Rails.logger.error("BPMN: Error firing status triggers for #{self.class.name}##{id}: #{e.message}")
    # Don't raise - we don't want to block the save
  end

  def fire_bpmn_field_triggers
    return if _bpmn_field_triggers.empty?

    changed_fields = _bpmn_field_triggers.select do |field_name|
      saved_change_to_attribute?(field_name)
    end

    return if changed_fields.empty?

    Bpmn::TriggerFiringService.fire_field_change(
      entity: self,
      changed_fields: changed_fields
    )
  rescue StandardError => e
    Rails.logger.error("BPMN: Error firing field triggers for #{self.class.name}##{id}: #{e.message}")
    # Don't raise - we don't want to block the save
  end

  # If field is something like 'job_status_id', try to get the name from the association
  def resolve_status_display(field_name, value)
    return value.to_s if value.nil?

    # Check if this looks like a belongs_to foreign key
    if field_name.end_with?("_id")
      assoc_name = field_name.sub(/_id$/, "")
      assoc = self.class.reflect_on_association(assoc_name.to_sym)

      if assoc && assoc.macro == :belongs_to
        # Try to load the associated record and get its name
        related = assoc.klass.find_by(id: value)
        return related.name if related.respond_to?(:name)
      end
    end

    value.to_s
  end

  # Normalize field name for trigger matching (job_status_id -> status)
  def normalize_field_name(field_name)
    # Convert job_status_id to status for trigger matching
    field_name.sub(/^job_/, "").sub(/_id$/, "")
  end
end
