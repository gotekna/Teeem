class CreateXeroDuplicateTables < ActiveRecord::Migration[8.0]
  def change
    create_table :xero_duplicate_groups do |t|
      t.string :group_key, null: false # Hash of match criteria
      t.string :match_type, null: false # "abn", "display_name", "ato_asic"
      t.decimal :confidence_score, precision: 5, scale: 2
      t.string :status, default: "pending" # pending, approved, rejected, merged
      t.integer :merge_target_id # Contact ID to keep
      t.datetime :reviewed_at
      t.string :reviewed_by
      t.timestamps
    end

    create_table :xero_duplicate_items do |t|
      t.references :duplicate_group, null: false, foreign_key: { to_table: :xero_duplicate_groups }
      t.references :contact, null: false, foreign_key: true
      t.boolean :is_merge_target, default: false
      t.jsonb :data_snapshot # Store contact data at detection time
      t.timestamps
    end

    add_index :xero_duplicate_groups, :status
    add_index :xero_duplicate_groups, :group_key, unique: true
    add_index :xero_duplicate_items, [:duplicate_group_id, :contact_id], unique: true
  end
end
