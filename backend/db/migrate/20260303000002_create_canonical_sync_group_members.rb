class CreateCanonicalSyncGroupMembers < ActiveRecord::Migration[7.2]
  def change
    create_table :canonical_sync_group_members do |t|
      t.bigint  :tenant_id, null: false
      t.string  :sync_direction, default: "bidirectional", null: false
      t.boolean :is_active, default: true
      t.timestamps
    end

    add_index :canonical_sync_group_members, :tenant_id, unique: true
    add_foreign_key :canonical_sync_group_members, :tenants, column: :tenant_id
  end
end
