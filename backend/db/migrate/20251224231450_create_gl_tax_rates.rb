# frozen_string_literal: true

class CreateGlTaxRates < ActiveRecord::Migration[8.0]
  def change
    create_table :gl_tax_rates do |t|
      t.references :corporate, null: false, foreign_key: true

      # External provider linking
      t.string :external_provider         # 'xero', 'quickbooks', 'myob', nil
      t.string :external_tenant_id        # Provider's org/company ID
      t.string :external_tax_type         # Provider's tax type code

      # Tax Identity
      t.string :code, null: false         # "GST", "GST-FREE", "BAS-EXCLUDED"
      t.string :name, null: false         # "GST on Income", "GST Free Income"
      t.string :tax_type                  # 'output' (sales), 'input' (purchases)

      # Rate
      t.decimal :rate, precision: 5, scale: 2, null: false  # 10.00 for 10%

      # Account linking (for GST collected/paid accounts)
      t.references :gl_account, foreign_key: true

      # Status
      t.boolean :active, default: true
      t.boolean :can_apply_to_expenses, default: true
      t.boolean :can_apply_to_revenue, default: true

      t.timestamps
    end

    # Unique constraint: one tax code per company per provider tenant
    add_index :gl_tax_rates, [:corporate_id, :external_provider, :external_tenant_id, :code],
              unique: true, name: 'idx_gl_tax_rates_unique'

    # Performance indexes
    add_index :gl_tax_rates, :active
    add_index :gl_tax_rates, :tax_type
  end
end
