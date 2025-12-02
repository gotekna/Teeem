# frozen_string_literal: true

# Automatic column type validation for ALL models
# Include this in ApplicationRecord to enable automatic validation
# based on column types defined in the columns table
#
# This ensures ALL tables follow the same validation rules as Gold Standard
#
module AutoColumnValidation
  extend ActiveSupport::Concern

  included do
    before_validation :validate_column_types
    before_save :format_column_values
  end

  private

  def validate_column_types
    ColumnTypeValidator.validate_record(self)
  end

  def format_column_values
    ColumnTypeValidator.format_record(self)
  end
end
