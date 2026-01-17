# frozen_string_literal: true

# Multi-tenancy Phase 3: Create TemplatePack and TemplatePackItem models
# For sharing configuration templates between tenants
class CreateTemplatePacks < ActiveRecord::Migration[8.0]
  def change
    create_table :template_packs do |t|
      t.references :source_tenant, null: false, foreign_key: { to_table: :corporate_groups }
      t.references :created_by, foreign_key: { to_table: :users }

      t.string :name, null: false
      t.text :description
      t.integer :status, default: 0  # 0=draft, 1=published, 2=archived
      t.integer :visibility, default: 0  # 0=private, 1=marketplace, 2=curated
      t.string :version
      t.integer :downloads_count, default: 0

      t.timestamps
    end

    create_table :template_pack_items do |t|
      t.references :template_pack, null: false, foreign_key: true

      t.string :item_type, null: false  # 'job_types', 'job_statuses', etc.
      t.jsonb :data, null: false, default: {}
      t.integer :position

      t.timestamps
    end

    add_index :template_packs, [:source_tenant_id, :name], unique: true
    add_index :template_packs, :status
    add_index :template_packs, :visibility
    add_index :template_pack_items, :item_type
  end
end
