# frozen_string_literal: true

module Gl
  # Individual column definition for a custom report
  class ReportColumn < ApplicationRecord
    self.table_name = "gl_report_columns"

    DATA_TYPES = %w[string number currency date datetime boolean percent].freeze
    AGGREGATIONS = %w[sum avg min max count].freeze
    FORMATS = %w[currency percent date_short date_long datetime number integer].freeze

    belongs_to :custom_report, class_name: "Gl::CustomReport"

    validates :field_path, presence: true
    validates :position, presence: true
    validates :data_type, inclusion: { in: DATA_TYPES }, allow_blank: true
    validates :aggregation, inclusion: { in: AGGREGATIONS }, allow_blank: true
    validates :format, inclusion: { in: FORMATS }, allow_blank: true

    scope :visible, -> { where(visible: true) }
    scope :ordered, -> { order(:position) }

    before_create :set_defaults

    # Apply conditional formatting rules
    def format_with_conditions(value)
      return nil if value.nil?

      result = { value: value, styles: [] }

      conditional_formatting.each do |rule|
        if matches_condition?(value, rule)
          result[:styles] << rule["style"]
        end
      end

      result
    end

    private

    def set_defaults
      self.display_name ||= field_path.split(".").last.humanize
      self.data_type ||= infer_data_type
    end

    def infer_data_type
      return "currency" if field_path.match?(/amount|total|balance|price|cost|revenue|profit/)
      return "date" if field_path.match?(/date|_at$/)
      return "number" if field_path.match?(/count|quantity|hours|percent/)
      "string"
    end

    def matches_condition?(value, rule)
      operator = rule["operator"]
      threshold = rule["value"]

      case operator
      when "eq" then value == threshold
      when "ne" then value != threshold
      when "gt" then value.to_f > threshold.to_f
      when "lt" then value.to_f < threshold.to_f
      when "gte" then value.to_f >= threshold.to_f
      when "lte" then value.to_f <= threshold.to_f
      when "between" then value.to_f.between?(threshold["min"].to_f, threshold["max"].to_f)
      when "contains" then value.to_s.include?(threshold.to_s)
      else false
      end
    end
  end
end
