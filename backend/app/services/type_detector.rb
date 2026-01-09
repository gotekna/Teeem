class TypeDetector
  SAMPLE_SIZE = 100  # Number of rows to sample for type detection

  def initialize(column_values)
    @column_values = column_values
  end

  # Detect the most appropriate column type for the given values
  def detect
    non_empty = @column_values.compact.reject(&:blank?).first(SAMPLE_SIZE)
    return "single_line_text" if non_empty.empty?

    # Calculate confidence scores for each type
    scores = {
      email: check_email(non_empty),
      boolean: check_boolean(non_empty),
      date_and_time: check_datetime(non_empty),
      date: check_date(non_empty),
      currency: check_currency(non_empty),
      percentage: check_percentage(non_empty),
      whole_number: check_whole_number(non_empty),
      number: check_number(non_empty)
    }

    # Find the type with the highest confidence score
    best_type, best_score = scores.max_by { |_type, score| score }

    # Require at least 80% confidence, otherwise default to text
    if best_score >= 0.8
      best_type.to_s
    elsif non_empty.any? { |v| v.to_s.length > 255 }
      "multiple_lines_text"
    else
      "single_line_text"
    end
  end

  private

  def check_email(values)
    matches = values.count { |v| v.to_s.match?(/\A[^@\s]+@[^@\s]+\.[^@\s]+\z/) }
    matches.to_f / values.length
  end

  def check_boolean(values)
    bool_values = [ "true", "false", "yes", "no", "1", "0", "t", "f", "y", "n" ]
    matches = values.count { |v| bool_values.include?(v.to_s.downcase.strip) }
    matches.to_f / values.length
  end

  def check_whole_number(values)
    matches = values.count do |v|
      v.to_s.strip.match?(/^\-?\d+$/)
    end
    matches.to_f / values.length
  end

  def check_number(values)
    matches = values.count do |v|
      begin
        Float(v.to_s.strip.gsub(/[$,%]/, ""))
        true
      rescue ArgumentError, TypeError
        false
      end
    end
    matches.to_f / values.length
  end

  def check_currency(values)
    # Check for $ symbol or decimal values
    currency_matches = values.count do |v|
      v.to_s.strip.match?(/^\$?\-?\d+\.?\d*$/) || v.to_s.strip.match?(/^\$/)
    end

    has_currency_symbol = values.any? { |v| v.to_s.include?("$") }
    base_score = currency_matches.to_f / values.length

    # Boost score if we see $ symbols
    has_currency_symbol ? [ base_score + 0.2, 1.0 ].min : base_score
  end

  def check_percentage(values)
    percentage_matches = values.count do |v|
      v.to_s.strip.match?(/%$/) ||
      (v.to_s.strip.match?(/^\d+\.?\d*$/) && v.to_f.between?(0, 100))
    end

    has_percent_symbol = values.any? { |v| v.to_s.include?("%") }
    base_score = percentage_matches.to_f / values.length

    # Boost score if we see % symbols
    has_percent_symbol ? [ base_score + 0.3, 1.0 ].min : base_score * 0.5
  end

  def check_date(values)
    matches = values.count { |v| parseable_as_date?(v) }
    matches.to_f / values.length
  end

  def check_datetime(values)
    matches = values.count { |v| parseable_as_datetime?(v) && !parseable_as_date_only?(v) }
    matches.to_f / values.length
  end

  def parseable_as_date?(value)
    Date.parse(value.to_s)
    true
  rescue ArgumentError, TypeError
    false
  end

  def parseable_as_datetime?(value)
    DateTime.parse(value.to_s)
    true
  rescue ArgumentError, TypeError
    false
  end

  def parseable_as_date_only?(value)
    # Check if it's a date without time component
    str = value.to_s.strip
    !str.match?(/\d{1,2}:\d{2}/)  # No time component like "14:30"
  end
end
