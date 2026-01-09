# frozen_string_literal: true

# CostCentre - Business segment tracking for cost allocation (simPRO-style)
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
class CreateCostCentres < ActiveRecord::Migration[8.0]
  def change
    create_table :cost_centres do |t|
      # Hierarchy support (tree structure)
      t.references :parent, foreign_key: { to_table: :cost_centres, on_delete: :nullify }

      # Identity
      t.string :code, null: false, limit: 20       # e.g., "CC-001"
      t.string :name, null: false, limit: 100      # e.g., "Residential Projects"
      t.text :description

      # Classification
      t.string :centre_type, limit: 30             # "department", "project", "division", "region"

      # Cost allocation settings
      t.decimal :overhead_allocation_percent, precision: 5, scale: 2, default: 0
      t.decimal :budget_amount, precision: 14, scale: 2

      # Status
      t.boolean :active, default: true

      # Metadata
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    # Indexes (parent_id already indexed by t.references)
    add_index :cost_centres, :code, unique: true
    add_index :cost_centres, :centre_type
    add_index :cost_centres, :active
  end
end
