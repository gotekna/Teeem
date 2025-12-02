class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  # Include automatic column type validation for ALL models
  # Validation rules are defined once in ColumnTypeValidator
  # and applied based on column_type from the columns table
  include AutoColumnValidation
end
