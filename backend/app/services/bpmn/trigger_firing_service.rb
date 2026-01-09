module Bpmn
  class TriggerFiringService
    class << self
      # Fire triggers when a status field changes
      def fire_status_change(entity:, field_name:, old_value:, new_value:)
        return if old_value == new_value

        Rails.logger.info("BPMN TriggerFiring: Status change on #{entity.class.name}##{entity.id} - #{field_name}: #{old_value} -> #{new_value}")

        triggers = find_matching_triggers(
          trigger_type: "status_change",
          entity_type: entity.class.name,
          field_name: field_name,
          old_value: old_value,
          new_value: new_value
        )

        triggers.each do |trigger|
          fire_trigger(trigger, entity)
        end

        triggers.count
      end

      # Fire triggers when any field changes
      def fire_field_change(entity:, changed_fields:)
        return if changed_fields.empty?

        Rails.logger.info("BPMN TriggerFiring: Field change on #{entity.class.name}##{entity.id} - fields: #{changed_fields.join(', ')}")

        fired_count = 0
        changed_fields.each do |field_name|
          triggers = find_matching_triggers(
            trigger_type: "field_change",
            entity_type: entity.class.name,
            field_name: field_name
          )

          triggers.each do |trigger|
            fire_trigger(trigger, entity)
            fired_count += 1
          end
        end

        fired_count
      end

      # Manually fire a trigger
      def fire_manual(trigger_id:, subject:, variables: {}, user: nil)
        trigger = BpmnTrigger.find(trigger_id)

        unless trigger.manual?
          raise ArgumentError, "Trigger #{trigger_id} is not a manual trigger"
        end

        unless trigger.is_active
          raise ArgumentError, "Trigger #{trigger_id} is not active"
        end

        Rails.logger.info("BPMN TriggerFiring: Manual trigger '#{trigger.name}' fired by user #{user&.id}")

        fire_trigger(trigger, subject, variables: variables, triggered_by: "manual:#{user&.id}")
      end

      # Fire trigger via webhook
      def fire_webhook(trigger_id:, payload:, secret: nil)
        trigger = BpmnTrigger.find(trigger_id)

        unless trigger.webhook?
          raise ArgumentError, "Trigger #{trigger_id} is not a webhook trigger"
        end

        unless trigger.is_active
          raise ArgumentError, "Trigger #{trigger_id} is not active"
        end

        # Verify secret if configured
        if trigger.webhook_secret.present? && trigger.webhook_secret != secret
          raise SecurityError, "Invalid webhook secret"
        end

        Rails.logger.info("BPMN TriggerFiring: Webhook trigger '#{trigger.name}' fired")

        # For webhooks, we need to determine the subject from payload
        subject = resolve_webhook_subject(trigger, payload)
        variables = payload.merge("_webhook_payload" => payload)

        fire_trigger(trigger, subject, variables: variables, triggered_by: "webhook")
      end

      private

      def find_matching_triggers(trigger_type:, entity_type:, field_name: nil, old_value: nil, new_value: nil)
        triggers = BpmnTrigger.active.where(trigger_type: trigger_type)

        # Filter by entity type in config
        triggers = triggers.select do |t|
          t.entity_type == entity_type
        end

        # Filter by field name if specified
        if field_name.present?
          triggers = triggers.select { |t| t.field_name.blank? || t.field_name == field_name }
        end

        # For status_change, also filter by from/to values
        if trigger_type == "status_change"
          triggers = triggers.select do |t|
            from_match = t.from_values.empty? || t.from_values.include?(old_value.to_s)
            to_match = t.to_values.empty? || t.to_values.include?(new_value.to_s)
            from_match && to_match
          end
        end

        triggers
      end

      def fire_trigger(trigger, subject, variables: {}, triggered_by: nil)
        process = trigger.bpmn_process

        unless process.published?
          Rails.logger.warn("BPMN TriggerFiring: Skipping trigger '#{trigger.name}' - process not published")
          return nil
        end

        triggered_by ||= "trigger:#{trigger.id}:#{trigger.trigger_type}"

        # Build variables from subject
        subject_variables = extract_subject_variables(subject)
        all_variables = subject_variables.merge(variables).merge(
          "_trigger_id" => trigger.id,
          "_trigger_name" => trigger.name,
          "_trigger_type" => trigger.trigger_type
        )

        begin
          instance = Bpmn::EngineService.start_process(
            process_id: process.id,
            subject: subject,
            variables: all_variables,
            triggered_by: triggered_by
          )

          Rails.logger.info("BPMN TriggerFiring: Started process instance ##{instance.id} for trigger '#{trigger.name}'")
          instance
        rescue => e
          Rails.logger.error("BPMN TriggerFiring: Failed to start process for trigger '#{trigger.name}': #{e.message}")
          raise
        end
      end

      def extract_subject_variables(subject)
        return {} unless subject.respond_to?(:attributes)

        # Extract common fields as variables
        vars = {}

        # Add all scalar attributes
        subject.attributes.each do |key, value|
          next if value.is_a?(Hash) || value.is_a?(Array)
          vars["subject_#{key}"] = value
        end

        # Add convenience accessors
        vars["subject_type"] = subject.class.name
        vars["subject_id"] = subject.id

        # For Job, add some computed fields
        if subject.is_a?(Job)
          vars["job_name"] = subject.name
          vars["job_status"] = subject.job_status&.name
          vars["job_stage"] = subject.job_stage&.name
          # SSoT: contract_price is THE ONE
          vars["contract_value"] = subject.contract_price
        end

        vars
      end

      def resolve_webhook_subject(trigger, payload)
        entity_type = trigger.entity_type
        entity_id = payload["entity_id"] || payload["id"] || payload["subject_id"]

        if entity_type.present? && entity_id.present?
          entity_type.constantize.find(entity_id)
        else
          # Create a null subject for webhooks without entity reference
          OpenStruct.new(id: nil, class: OpenStruct.new(name: "Webhook"))
        end
      end
    end
  end
end
