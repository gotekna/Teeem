module Bpmn
  module Tasks
    class SetVariableTask < BaseTask
      def execute
        variables_to_set = @config["variables"] || {}
        set_count = 0

        variables_to_set.each do |var_name, value_config|
          value = resolve_value(value_config)
          set_variable(var_name, value)
          set_count += 1
          log_info("Set variable '#{var_name}' = #{value.inspect}")
        end

        {
          variables_set: variables_to_set.keys,
          count: set_count,
          set_at: Time.current.iso8601
        }
      end

      private

      def resolve_value(value_config)
        if value_config.is_a?(Hash)
          case value_config["type"]
          when "static"
            value_config["value"]
          when "subject_field"
            @subject.try(value_config["field"])
          when "expression"
            evaluate_expression(value_config["value"])
          when "current_time"
            Time.current.iso8601
          when "current_date"
            Date.current.to_s
          else
            value_config["value"]
          end
        else
          interpolate(value_config.to_s)
        end
      end

      def evaluate_expression(expression)
        Bpmn::ConditionEvaluator.new(@variables).evaluate(expression)
      rescue StandardError
        nil
      end
    end
  end
end
