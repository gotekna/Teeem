# frozen_string_literal: true

# Add xero_scope to EntityTab for indicating Xero integration
#
# Values:
#   nil      - No Xero scope (default)
#   "primary" - Uses the PRIMARY Xero account (XeroCredential.is_primary = true)
#   tenant_id - Specific Xero tenant (future use)
#
class AddXeroScopeToEntityTabs < ActiveRecord::Migration[8.0]
  def change
    add_column :entity_tabs, :xero_scope, :string

    # Set Bills and Invoices tabs to use primary Xero
    reversible do |dir|
      dir.up do
        EntityTab.where(tab_key: %w[bills invoices]).update_all(xero_scope: "primary")
      end
    end
  end
end
