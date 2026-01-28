class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  # Include automatic column type validation for ALL models
  # Validation rules are defined once in ColumnTypeValidator
  # and applied based on column_type from the columns table
  include AutoColumnValidation

  # Handle renamed polymorphic class names (legacy data compatibility)
  # EmailWarehouse was renamed to SyncedEmail in Jan 2026
  # EmailAttachment was removed in Jan 2026 - attachments now in WarehouseDocument
  def self.polymorphic_class_for(name)
    case name
    when "EmailWarehouse"
      SyncedEmail
    when "EmailAttachment"
      WarehouseDocument
    else
      super
    end
  end
end
