class CreateSyncExclusionRules < ActiveRecord::Migration[8.0]
  def change
    create_table :sync_exclusion_rules do |t|
      # Org-level rules apply to all users; user-level rules override for that user
      t.references :organization, foreign_key: true
      t.references :user, foreign_key: true

      # Rule definition
      t.string :rule_type, null: false  # 'extension', 'size', 'pattern'
      t.string :value, null: false      # '.rvt', '500MB', '*.tmp'
      t.string :action, null: false, default: "skip"  # 'skip' or 'include'

      # Metadata
      t.string :description  # Human-readable description
      t.boolean :is_default, default: false  # System default rule
      t.integer :priority, default: 0  # Higher priority rules evaluated first

      t.timestamps
    end

    add_index :sync_exclusion_rules, :organization_id
    add_index :sync_exclusion_rules, :user_id
    add_index :sync_exclusion_rules, [:rule_type, :value]
    add_index :sync_exclusion_rules, :is_default
  end
end
