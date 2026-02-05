# frozen_string_literal: true

class CreateTakeoffTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :takeoff_templates do |t|
      t.references :tenant, null: false, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users }

      t.string :name, null: false
      t.string :description
      t.string :category  # e.g., "doors", "windows", "rooms", "custom"
      t.boolean :is_system, default: false  # System templates vs user-created
      t.boolean :is_active, default: true

      # Template configuration stored as JSON
      # Structure: { steps: [ { type: "count"|"area"|"linear"|"perimeter", label: string, color: string, prompt?: string } ] }
      t.jsonb :configuration, null: false, default: {}

      # Usage tracking
      t.integer :usage_count, default: 0

      t.timestamps
    end

    add_index :takeoff_templates, [:tenant_id, :name], unique: true
    add_index :takeoff_templates, [:tenant_id, :category]
    add_index :takeoff_templates, [:tenant_id, :is_active]
  end
end
