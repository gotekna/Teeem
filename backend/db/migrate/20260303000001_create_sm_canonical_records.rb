class CreateSmCanonicalRecords < ActiveRecord::Migration[7.2]
  def change
    create_table :sm_canonical_records do |t|
      t.string  :record_type, null: false
      t.string  :sync_key, null: false
      t.string  :name, null: false
      t.jsonb   :fields, default: {}
      t.jsonb   :fk_sync_keys, default: {}
      t.integer :version, default: 1
      t.datetime :last_propagated_at
      t.timestamps
    end

    add_index :sm_canonical_records, [:record_type, :sync_key], unique: true, name: "idx_canonical_records_type_sync_key"
    add_index :sm_canonical_records, :record_type, name: "idx_canonical_records_type"
  end
end
