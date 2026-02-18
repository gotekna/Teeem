# frozen_string_literal: true

class CreateProfitCentres < ActiveRecord::Migration[8.0]
  def change
    create_table :profit_centres do |t|
      t.references :tenant, null: false, foreign_key: true

      # Job link (NULL = global template, set = job-specific)
      t.references :job, foreign_key: { on_delete: :cascade }, null: true

      # Identity
      t.string :code, null: false, limit: 20       # e.g., "DESIGN", "BASE", "VAR-001"
      t.string :name, null: false, limit: 100      # e.g., "Design", "Base Contract", "Variation 1"

      # Classification
      t.string :centre_type, limit: 30             # "base", "design", "variation", "other"

      # Details
      t.text :description

      # Template flag (global templates auto-available to all jobs)
      t.boolean :is_template, default: false

      # Status & ordering
      t.boolean :active, default: true
      t.integer :sort_order, default: 0

      # Budget
      t.decimal :budget_amount, precision: 15, scale: 2

      # Metadata
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    # Global templates: unique code per tenant (where job_id IS NULL)
    add_index :profit_centres, [:tenant_id, :code],
              unique: true,
              where: "job_id IS NULL",
              name: "idx_profit_centres_global_unique_code"

    # Job-specific: unique code per job per tenant
    add_index :profit_centres, [:tenant_id, :job_id, :code],
              unique: true,
              where: "job_id IS NOT NULL",
              name: "idx_profit_centres_job_unique_code"

    add_index :profit_centres, :is_template
    add_index :profit_centres, :active
    add_index :profit_centres, :centre_type
  end
end
