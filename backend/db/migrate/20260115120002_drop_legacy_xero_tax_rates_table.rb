# frozen_string_literal: true

# SSoT Cleanup: Drop legacy xero_tax_rates table
#
# This table was a sync cache that duplicates gl_tax_rates.
# Gl::TaxRate supports multiple providers (xero, quickbooks, myob) via external_provider column.
#
# DELETED:
# - xero_tax_rates table (6 columns)
# - XeroTaxRate model (2 lines)
#
# THE ONE: Gl::TaxRate (gl_tax_rates table with external_provider: 'xero')
#
class DropLegacyXeroTaxRatesTable < ActiveRecord::Migration[8.0]
  def up
    drop_table :xero_tax_rates, if_exists: true
    Rails.logger.info "[SSoT] Dropped xero_tax_rates table - use Gl::TaxRate with external_provider: 'xero'"
  end

  def down
    create_table :xero_tax_rates do |t|
      t.string :code
      t.string :name
      t.decimal :rate
      t.boolean :active
      t.string :display_rate
      t.string :tax_type
      t.timestamps
    end
  end
end
