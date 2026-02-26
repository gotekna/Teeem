# frozen_string_literal: true

# Split tenders table into tender_headers + tenders (sections only).
#
# Before: tenders table has parent_id = NULL (headers) and parent_id set (sections)
# After:  tender_headers table has headers, tenders table has sections with tender_header_id FK
#
# Key insight: Header rows are copied to tender_headers PRESERVING original IDs,
# so tender_header_id = old parent_id (trivial remap).
#
class SplitTendersIntoHeadersAndSections < ActiveRecord::Migration[8.0]
  def up
    # ═══════════════════════════════════════════════════════════════════════════
    # 1. Create tender_headers table
    # ═══════════════════════════════════════════════════════════════════════════
    create_table :tender_headers do |t|
      t.bigint :tenant_id, null: false
      t.string :code, limit: 20, null: false
      t.string :name, limit: 100, null: false
      t.text :description
      t.integer :sort_order
      t.boolean :active, default: true
      t.jsonb :metadata, default: {}
      t.string :sync_key
      t.timestamps
    end

    add_index :tender_headers, :tenant_id
    add_index :tender_headers, [:tenant_id, :code], unique: true
    add_index :tender_headers, :active
    add_index :tender_headers, :sort_order

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. Copy header rows (parent_id IS NULL) preserving IDs
    # ═══════════════════════════════════════════════════════════════════════════
    execute <<~SQL
      INSERT INTO tender_headers (id, tenant_id, code, name, description, sort_order, active, metadata, sync_key, created_at, updated_at)
      SELECT id, tenant_id, code, name, description, sort_order, active, metadata, sync_key, created_at, updated_at
      FROM tenders
      WHERE parent_id IS NULL
    SQL

    # Reset tender_headers sequence to max id + 1
    execute <<~SQL
      SELECT setval(pg_get_serial_sequence('tender_headers', 'id'), COALESCE((SELECT MAX(id) FROM tender_headers), 0) + 1, false)
    SQL

    puts "  Copied #{execute("SELECT COUNT(*) FROM tender_headers").first['count']} headers to tender_headers"

    # ═══════════════════════════════════════════════════════════════════════════
    # 3. Add tender_header_id FK to tenders
    # ═══════════════════════════════════════════════════════════════════════════
    add_column :tenders, :tender_header_id, :bigint

    # ═══════════════════════════════════════════════════════════════════════════
    # 4. Remap: tender_header_id = parent_id (IDs match because we preserved them)
    # ═══════════════════════════════════════════════════════════════════════════
    execute <<~SQL
      UPDATE tenders SET tender_header_id = parent_id WHERE parent_id IS NOT NULL
    SQL

    # ═══════════════════════════════════════════════════════════════════════════
    # 5. Drop self-referential FK on parent_id before deleting headers
    # ═══════════════════════════════════════════════════════════════════════════
    remove_foreign_key :tenders, column: :parent_id

    # ═══════════════════════════════════════════════════════════════════════════
    # 6. Delete header rows from tenders (they now live in tender_headers)
    # ═══════════════════════════════════════════════════════════════════════════
    execute <<~SQL
      DELETE FROM tenders WHERE parent_id IS NULL
    SQL

    # ═══════════════════════════════════════════════════════════════════════════
    # 7. Remove parent_id, add NOT NULL + FK on tender_header_id
    # ═══════════════════════════════════════════════════════════════════════════
    remove_column :tenders, :parent_id
    change_column_null :tenders, :tender_header_id, false
    add_index :tenders, :tender_header_id
    add_foreign_key :tenders, :tender_headers
  end

  def down
    # ═══════════════════════════════════════════════════════════════════════════
    # Reverse: Add parent_id back, copy headers back, remove tender_header_id
    # ═══════════════════════════════════════════════════════════════════════════
    remove_foreign_key :tenders, :tender_headers

    add_column :tenders, :parent_id, :bigint

    # Set parent_id from tender_header_id
    execute <<~SQL
      UPDATE tenders SET parent_id = tender_header_id
    SQL

    # Copy headers back from tender_headers into tenders
    execute <<~SQL
      INSERT INTO tenders (id, tenant_id, code, name, description, sort_order, active, metadata, sync_key, created_at, updated_at, section_type, show_line_items, parent_id)
      SELECT id, tenant_id, code, name, description, sort_order, active, metadata, sync_key, created_at, updated_at, 'priced', true, NULL
      FROM tender_headers
    SQL

    # Reset tenders sequence
    execute <<~SQL
      SELECT setval(pg_get_serial_sequence('tenders', 'id'), COALESCE((SELECT MAX(id) FROM tenders), 0) + 1, false)
    SQL

    remove_column :tenders, :tender_header_id
    add_index :tenders, :parent_id
    add_foreign_key :tenders, :tenders, column: :parent_id

    drop_table :tender_headers
  end
end
