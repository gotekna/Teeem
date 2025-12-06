class FormulaEvaluator
  def initialize(table)
    @table = table
    @calculator = Dentaku::Calculator.new
  end

  # Evaluate a formula for a specific record
  # Also handles cross-table references via lookup columns (e.g., {category.tax_rate})
  def evaluate(formula_expression, record_data, record_instance = nil)
    return nil if formula_expression.blank?

    # Convert field references like {Field Name} to variable names
    # Store mapping of variable names to actual values
    variables = {}
    processed_formula = formula_expression.dup

    # Find all field references in the format {Field Name} or {lookup.field}
    formula_expression.scan(/\{([^}]+)\}/).each do |match|
      field_reference = match[0]

      # Check if this is a cross-table reference (contains a dot)
      if field_reference.include?(".")
        # Cross-table reference: {lookup_column.field_name}
        lookup_column_name, related_field_name = field_reference.split(".", 2)

        # Find the lookup column
        lookup_column = @table.columns.find { |c| c.name == lookup_column_name }

        if lookup_column && lookup_column.column_type.in?([ "lookup", "multiple_lookups" ]) && record_instance
          # Get the related record
          begin
            related_record_id = record_data[lookup_column.column_name]

            if related_record_id.present? && lookup_column.lookup_table
              related_record = lookup_column.lookup_table.dynamic_model.find_by(id: related_record_id)

              if related_record
                # Find the column in the related table
                related_column = lookup_column.lookup_table.columns.find { |c| c.name == related_field_name }

                if related_column
                  value = related_record.send(related_column.column_name)

                  # Create a safe variable name
                  var_name = field_reference.gsub(/[^a-zA-Z0-9_]/, "_").downcase

                  # Convert to numeric if possible
                  numeric_value = value.to_f if value.present? && value.to_s.match?(/^-?\d*\.?\d+$/)
                  variables[var_name] = numeric_value || value || 0

                  # Replace in formula
                  processed_formula.gsub!("{#{field_reference}}", var_name)
                else
                  # Related field not found
                  processed_formula.gsub!("{#{field_reference}}", "0")
                end
              else
                # Related record not found
                processed_formula.gsub!("{#{field_reference}}", "0")
              end
            else
              # No related record ID
              processed_formula.gsub!("{#{field_reference}}", "0")
            end
          rescue => e
            Rails.logger.error("Error evaluating cross-table reference {#{field_reference}}: #{e.message}")
            processed_formula.gsub!("{#{field_reference}}", "0")
          end
        else
          # Lookup column not found or not a lookup type
          processed_formula.gsub!("{#{field_reference}}", "0")
        end
      else
        # Same-table reference: {Field Name}
        field_name = field_reference

        # Find the column with this name
        column = @table.columns.find { |c| c.name == field_name }

        if column
          # Create a safe variable name (replace spaces with underscores, etc.)
          var_name = field_name.gsub(/[^a-zA-Z0-9_]/, "_").downcase

          # Get the value from the record data
          value = record_data[column.column_name]

          # Convert to numeric if possible, otherwise use as string
          numeric_value = value.to_f if value.present? && value.to_s.match?(/^-?\d*\.?\d+$/)
          variables[var_name] = numeric_value || value || 0

          # Replace {Field Name} with var_name in the formula
          processed_formula.gsub!("{#{field_name}}", var_name)
        else
          # Field not found, replace with 0
          processed_formula.gsub!("{#{field_name}}", "0")
        end
      end
    end

    begin
      # Evaluate the formula with the variables
      result = @calculator.evaluate(processed_formula, variables)

      # Round to 2 decimal places if it's a float
      result.is_a?(Float) ? result.round(2) : result
    rescue Dentaku::ParseError, Dentaku::ArgumentError => e
      Rails.logger.error("Formula evaluation error: #{e.message}")
      "ERROR: #{e.message}"
    rescue => e
      Rails.logger.error("Unexpected formula error: #{e.class} - #{e.message}")
      "ERROR"
    end
  end

  # Helper method to detect if a formula uses cross-table references
  def self.uses_cross_table_references?(formula_expression)
    return false if formula_expression.blank?

    # Check if any field reference contains a dot (e.g., {category.tax_rate})
    formula_expression.scan(/\{([^}]+)\}/).any? { |match| match[0].include?(".") }
  end

  # Batch evaluate formula for multiple records
  def evaluate_for_records(formula_expression, records)
    records.map do |record|
      evaluate(formula_expression, record)
    end
  end
end
