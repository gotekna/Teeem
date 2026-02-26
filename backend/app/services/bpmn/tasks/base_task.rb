module Bpmn
  module Tasks
    # Raised for errors that are permanent and should NOT be retried
    # (e.g., referenced record deleted, invalid configuration).
    # ServiceTaskExecutor catches this and fails the process immediately.
    class PermanentError < StandardError; end

    class BaseTask
      def initialize(token, config)
        @token = token
        @config = config
        @instance = token.bpmn_process_instance
        @subject = @instance.subject
        @variables = @instance.variables
      end

      def execute
        raise NotImplementedError, "Subclasses must implement #execute"
      end

      protected

      # Interpolate template strings with variables and subject fields
      # Example: "Hello {{client_name}}, your order {{subject.id}} is ready"
      def interpolate(template)
        return template unless template.is_a?(String)

        result = template.dup

        # Replace {{variable}} patterns
        result.gsub!(/\{\{(\w+)\}\}/) do |_match|
          var_name = Regexp.last_match(1)
          @variables[var_name] || ""
        end

        # Replace {{subject.field}} patterns
        result.gsub!(/\{\{subject\.(\w+)\}\}/) do |_match|
          field_name = Regexp.last_match(1)
          @subject&.send(field_name) || ""
        end

        result
      end

      # Get a config value, optionally interpolating templates
      def get_config(key, interpolate_value: true)
        value = @config[key]
        interpolate_value && value.is_a?(String) ? interpolate(value) : value
      end

      # Set a process variable
      def set_variable(key, value)
        @instance.set_variable(key, value)
      end

      # Log task activity
      def log_info(message)
        Rails.logger.info("BPMN Task [#{self.class.name}]: #{message}")
      end

      def log_error(message)
        Rails.logger.error("BPMN Task [#{self.class.name}]: #{message}")
      end
    end
  end
end
