# frozen_string_literal: true

module Gl
  # Filter definition for a custom report
  class ReportFilter < ApplicationRecord
    self.table_name = "gl_report_filters"

    OPERATORS = %w[eq ne gt lt gte lte contains starts_with in between is_null is_not_null].freeze
    VALUE_TYPES = %w[static parameter relative_date].freeze
    CONJUNCTIONS = %w[and or].freeze

    belongs_to :custom_report, class_name: "Gl::CustomReport"

    validates :field_path, presence: true
    validates :operator, presence: true, inclusion: { in: OPERATORS }
    validates :position, presence: true
    validates :value_type, inclusion: { in: VALUE_TYPES }, allow_blank: true
    validates :conjunction, inclusion: { in: CONJUNCTIONS }

    scope :ordered, -> { order(:position) }
    scope :required, -> { where(required: true) }
    scope :user_editable, -> { where(user_editable: true) }

    # Human-readable description
    def description
      field_name = field_path.split(".").last.humanize
      op_text = operator_text
      val_text = value_description

      "#{field_name} #{op_text} #{val_text}"
    end

    private

    def operator_text
      case operator
      when "eq" then "equals"
      when "ne" then "does not equal"
      when "gt" then "is greater than"
      when "lt" then "is less than"
      when "gte" then "is at least"
      when "lte" then "is at most"
      when "contains" then "contains"
      when "starts_with" then "starts with"
      when "in" then "is one of"
      when "between" then "is between"
      when "is_null" then "is empty"
      when "is_not_null" then "is not empty"
      else operator
      end
    end

    def value_description
      return "(empty)" if operator.in?(%w[is_null is_not_null])

      case value_type
      when "parameter" then "[parameter: #{value}]"
      when "relative_date" then relative_date_text
      else value.to_s
      end
    end

    def relative_date_text
      case value
      when "today" then "today"
      when "yesterday" then "yesterday"
      when "this_week" then "this week"
      when "last_week" then "last week"
      when "this_month" then "this month"
      when "last_month" then "last month"
      when "this_quarter" then "this quarter"
      when "last_quarter" then "last quarter"
      when "this_year" then "this year"
      when "last_year" then "last year"
      else value
      end
    end
  end
end
