module Bpmn
  module Tasks
    class UpdateRecordTask < BaseTask
      def execute
        updates = build_updates
        target = resolve_target

        raise "No target record found" unless target
        raise "No updates specified" if updates.empty?

        log_info("Updating #{target.class.name}##{target.id} with #{updates.keys.join(', ')}")

        target.update!(updates)

        {
          target_type: target.class.name,
          target_id: target.id,
          updated_fields: updates.keys,
          updated_at: Time.current.iso8601
        }
      end

      private

      def resolve_target
        target_type = @config["target_type"]

        case target_type
        when "subject", nil
          @subject
        when "variable"
          target_class = @config["target_class"]&.constantize
          target_id = @variables[@config["target_id_variable"]]
          target_class&.find_by(id: target_id)
        else
          # Try to find by class name and ID in config
          target_class = target_type.constantize
          target_id = @config["target_id"] || @variables["#{target_type.underscore}_id"]
          target_class.find_by(id: target_id)
        end
      rescue NameError
        nil
      end

      def build_updates
        updates = {}

        (@config["updates"] || {}).each do |field, value_config|
          updates[field] = resolve_value(value_config)
        end

        # Also support simple field: value format
        (@config["fields"] || {}).each do |field, value|
          updates[field] = interpolate_value(value)
        end

        updates
      end

      def resolve_value(value_config)
        if value_config.is_a?(Hash)
          case value_config["type"]
          when "static"
            value_config["value"]
          when "variable"
            @variables[value_config["value"]]
          when "expression"
            evaluate_expression(value_config["value"])
          when "current_time"
            Time.current
          when "current_date"
            Date.current
          when "current_user"
            @variables["_triggered_by"]
          else
            value_config["value"]
          end
        else
          interpolate_value(value_config)
        end
      end

      def interpolate_value(value)
        return value unless value.is_a?(String)

        # Check if it's a variable reference {{var_name}}
        if value.match?(/\A\{\{(\w+)\}\}\z/)
          var_name = value[2..-3]
          return @variables[var_name]
        end

        # Otherwise interpolate any embedded variables
        interpolate(value)
      end

      def evaluate_expression(expression)
        # Simple expression evaluation for things like "amount * 1.1"
        Bpmn::ConditionEvaluator.new(@variables).evaluate(expression)
      rescue StandardError
        nil
      end
    end
  end
end
