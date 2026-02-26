# frozen_string_literal: true

# FRC (Feb 2026): Sentry TEEEM-BACKEND-5Y reported FK violation errors because
# pricebooks.supplier_id and pricebooks.default_supplier_id reference contacts
# that no longer exist. This migration nullifies orphaned references.
#
# Root cause: Contacts were deleted without cleaning up pricebook references.
# The pricebooks table doesn't have a database-level FK constraint on supplier_id
# or default_supplier_id, so Rails didn't cascade the cleanup.
class NullifyOrphanedPricebookSupplierRefs < ActiveRecord::Migration[7.2]
  def up
    # Nullify supplier_id where the referenced contact doesn't exist
    execute <<-SQL
      UPDATE pricebooks
      SET supplier_id = NULL
      WHERE supplier_id IS NOT NULL
        AND supplier_id NOT IN (SELECT id FROM contacts)
    SQL

    # Nullify default_supplier_id where the referenced contact doesn't exist
    execute <<-SQL
      UPDATE pricebooks
      SET default_supplier_id = NULL
      WHERE default_supplier_id IS NOT NULL
        AND default_supplier_id NOT IN (SELECT id FROM contacts)
    SQL
  end

  def down
    # Data cleanup is not reversible
  end
end
