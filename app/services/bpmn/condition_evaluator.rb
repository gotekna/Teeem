module Bpmn
  class ConditionEvaluator
    # Evaluate a condition expression against variables
    # Supports simple expressions like:
    #   - "status == 'approved'"
    #   - "amount > 1000"
    #   - "priority == 'high' && amount > 5000"
    #   - "category in ['A', 'B', 'C']"
    def self.evaluate(expression, variables)
      return true if expression.blank?

      evaluator = new(variables)
      evaluator.evaluate(expression)
    end

    def initialize(variables)
      @variables = (variables || {}).stringify_keys
    end

    def evaluate(expression)
      # Replace variable references with actual values
      result = expression.dup

      # Handle 'in' operator: "x in ['a', 'b']" => ['a', 'b'].include?(x)
      result = result.gsub(/(\w+)\s+in\s+\[([^\]]+)\]/) do |_match|
        var_name = Regexp.last_match(1)
        array_str = Regexp.last_match(2)
        var_value = get_variable(var_name)
        array_values = parse_array_values(array_str)
        array_values.include?(var_value).to_s
      end

      # Handle 'not in' operator
      result = result.gsub(/(\w+)\s+not\s+in\s+\[([^\]]+)\]/) do |_match|
        var_name = Regexp.last_match(1)
        array_str = Regexp.last_match(2)
        var_value = get_variable(var_name)
        array_values = parse_array_values(array_str)
        (!array_values.include?(var_value)).to_s
      end

      # Handle 'contains' operator: "roles contains 'admin'"
      result = result.gsub(/(\w+)\s+contains\s+['"]([^'"]+)['"]/) do |_match|
        var_name = Regexp.last_match(1)
        search_value = Regexp.last_match(2)
        var_value = get_variable(var_name)
        contains_value?(var_value, search_value).to_s
      end

      # Handle 'is_empty' and 'is_not_empty'
      result = result.gsub(/(\w+)\s+is_empty/) do |_match|
        var_name = Regexp.last_match(1)
        var_value = get_variable(var_name)
        is_empty?(var_value).to_s
      end

      result = result.gsub(/(\w+)\s+is_not_empty/) do |_match|
        var_name = Regexp.last_match(1)
        var_value = get_variable(var_name)
        (!is_empty?(var_value)).to_s
      end

      # Replace variable names with their values
      @variables.each do |key, value|
        # Match whole word only
        result = result.gsub(/\b#{Regexp.escape(key)}\b/) do
          value_to_ruby(value)
        end
      end

      # Evaluate the expression safely
      safe_eval(result)
    rescue StandardError => e
      Rails.logger.error("BPMN ConditionEvaluator: Error evaluating '#{expression}': #{e.message}")
      false
    end

    private

    def get_variable(name)
      @variables[name]
    end

    def value_to_ruby(value)
      case value
      when String
        "'#{value.gsub("'", "\\'")}'"
      when Numeric, TrueClass, FalseClass
        value.to_s
      when NilClass
        "nil"
      when Array
        "[#{value.map { |v| value_to_ruby(v) }.join(', ')}]"
      else
        "'#{value}'"
      end
    end

    def parse_array_values(array_str)
      # Parse comma-separated values, handling quoted strings
      values = []
      array_str.scan(/['"]([^'"]+)['"]|(\d+(?:\.\d+)?)|(\w+)/) do |quoted, number, word|
        if quoted
          values << quoted
        elsif number
          values << (number.include?(".") ? number.to_f : number.to_i)
        elsif word
          values << word
        end
      end
      values
    end

    def contains_value?(container, value)
      case container
      when Array
        container.include?(value)
      when String
        container.include?(value)
      when Hash
        container.key?(value) || container.value?(value)
      else
        false
      end
    end

    def is_empty?(value)
      case value
      when NilClass
        true
      when String, Array, Hash
        value.empty?
      else
        false
      end
    end

    def safe_eval(expression)
      # Only allow safe operations
      allowed_pattern = /\A[\s\w'".<>=!&|()\[\],+-]+\z/
      unless expression.match?(allowed_pattern)
        Rails.logger.warn("BPMN ConditionEvaluator: Potentially unsafe expression: #{expression}")
        return false
      end

      # Replace logical operators for Ruby
      ruby_expr = expression
        .gsub(/\band\b/i, "&&")
        .gsub(/\bor\b/i, "||")
        .gsub(/\bnot\b/i, "!")
        .gsub(/\btrue\b/i, "true")
        .gsub(/\bfalse\b/i, "false")
        .gsub(/\bnil\b/i, "nil")

      # Evaluate in a safe binding
      binding.eval(ruby_expr)
    rescue StandardError => e
      Rails.logger.error("BPMN ConditionEvaluator: Safe eval failed for '#{expression}': #{e.message}")
      false
    end
  end
end
