# frozen_string_literal: true

# Migration: Create Quote Trackers
#
# Creates the quote_trackers table and Foundation for tracking supplier quotes
# on construction jobs. This is a PreCon feature for internal quote tracking
# (separate from QuoteRequest which is for sending RFQs to suppliers).
#
# Table: quote_trackers
# Foundation slug: quote-tracker
# Job tab: PreCon > Quote Tracker
#
class CreateQuoteTrackers < ActiveRecord::Migration[7.2]
  def up
    # ═══════════════════════════════════════════════════════════════════════════
    # Phase 1: Create the quote_trackers table
    # ═══════════════════════════════════════════════════════════════════════════
    create_table :quote_trackers do |t|
      t.references :tenant, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true
      t.references :sm_trade, foreign_key: true  # Category from SM Trades
      t.references :supplier, foreign_key: { to_table: :contacts }
      t.references :contact, foreign_key: { to_table: :contacts }
      t.string :contact_email
      t.date :requested_date
      t.boolean :received, default: false
      t.date :date_received
      t.string :quote_number
      t.decimal :price_quoted, precision: 12, scale: 2
      t.date :valid_to
      t.text :quote_request_instructions
      t.text :estimating_notes
      t.timestamps
    end

    add_index :quote_trackers, [:tenant_id, :job_id]
    add_index :quote_trackers, [:tenant_id, :supplier_id]

    # ═══════════════════════════════════════════════════════════════════════════
    # Phase 2: Create the Foundation
    # ═══════════════════════════════════════════════════════════════════════════
    foundation_id = execute(<<-SQL.squish).first['id']
      INSERT INTO foundations (
        name, singular_name, plural_name, database_table_name, model_class,
        slug, table_type, feature, searchable, is_live, has_ui, has_saved_views,
        created_at, updated_at
      )
      VALUES (
        'Quote Tracker', 'Quote Tracker', 'Quote Trackers', 'quote_trackers', 'QuoteTracker',
        'quote-tracker', 'system', 'precon', true, true, true, true,
        NOW(), NOW()
      )
      RETURNING id
    SQL

    puts "[CreateQuoteTrackers] Created Foundation with id: #{foundation_id}"

    # ═══════════════════════════════════════════════════════════════════════════
    # Phase 3: Get lookup foundation IDs
    # ═══════════════════════════════════════════════════════════════════════════
    contacts_foundation = execute("SELECT id FROM foundations WHERE slug = 'contacts'")
    contacts_foundation_id = contacts_foundation.count.positive? ? contacts_foundation.first['id'] : nil

    sm_trades_foundation = execute("SELECT id FROM foundations WHERE slug = 'sm_trades'")
    sm_trades_foundation_id = sm_trades_foundation.count.positive? ? sm_trades_foundation.first['id'] : nil

    jobs_foundation = execute("SELECT id FROM foundations WHERE slug = 'jobs'")
    jobs_foundation_id = jobs_foundation.count.positive? ? jobs_foundation.first['id'] : nil

    puts "[CreateQuoteTrackers] Lookup foundation IDs - contacts: #{contacts_foundation_id}, sm_trades: #{sm_trades_foundation_id}, jobs: #{jobs_foundation_id}"

    # ═══════════════════════════════════════════════════════════════════════════
    # Phase 4: Create columns
    # ═══════════════════════════════════════════════════════════════════════════
    columns = [
      { column_name: 'sm_trade_id', name: 'Category', column_type: 'lookup', position: 1,
        lookup_foundation_id: sm_trades_foundation_id, lookup_display_column: 'name' },
      { column_name: 'supplier_id', name: 'Supplier', column_type: 'lookup', position: 2,
        lookup_foundation_id: contacts_foundation_id, lookup_display_column: 'name' },
      { column_name: 'contact_id', name: 'Contact', column_type: 'lookup', position: 3,
        lookup_foundation_id: contacts_foundation_id, lookup_display_column: 'name' },
      { column_name: 'contact_email', name: 'Contact Email', column_type: 'email', position: 4 },
      { column_name: 'requested_date', name: 'Requested', column_type: 'date', position: 5 },
      { column_name: 'received', name: 'Received', column_type: 'boolean', position: 6 },
      { column_name: 'date_received', name: 'Date Received', column_type: 'date', position: 7 },
      { column_name: 'quote_number', name: 'Quote Number', column_type: 'single_line_text', position: 8 },
      { column_name: 'price_quoted', name: 'Price Quoted', column_type: 'currency', position: 9 },
      { column_name: 'valid_to', name: 'Valid To', column_type: 'date', position: 10 },
      { column_name: 'quote_request_instructions', name: 'Instructions', column_type: 'multiple_lines_text', position: 11 },
      { column_name: 'estimating_notes', name: 'Estimating Notes', column_type: 'multiple_lines_text', position: 12 },
      { column_name: 'job_id', name: 'Job', column_type: 'lookup', position: 13,
        lookup_foundation_id: jobs_foundation_id, lookup_display_column: 'name', has_ui: false }
    ]

    columns.each do |col|
      lookup_foundation_id_val = col[:lookup_foundation_id] ? col[:lookup_foundation_id] : 'NULL'
      lookup_display_column_val = col[:lookup_display_column] ? "'#{col[:lookup_display_column]}'" : 'NULL'
      has_ui_val = col[:has_ui] == false ? false : true  # Default to true unless explicitly false

      execute(<<-SQL.squish)
        INSERT INTO columns (
          foundation_id, column_name, name, column_type, position,
          lookup_foundation_id, lookup_display_column, has_ui,
          created_at, updated_at
        )
        VALUES (
          #{foundation_id},
          '#{col[:column_name]}',
          '#{col[:name]}',
          '#{col[:column_type]}',
          #{col[:position]},
          #{lookup_foundation_id_val},
          #{lookup_display_column_val},
          #{has_ui_val},
          NOW(), NOW()
        )
      SQL
    end

    puts "[CreateQuoteTrackers] Created #{columns.length} columns"

    # ═══════════════════════════════════════════════════════════════════════════
    # Phase 5: Add Quote Tracker tab under PreCon
    # ═══════════════════════════════════════════════════════════════════════════

    # Find the PreCon warehouse folder (parent tab)
    precon_result = execute(<<-SQL.squish)
      SELECT id FROM warehouse_folders
      WHERE warehouse_type = 'job' AND (tab_key = 'precon' OR display_name = 'PreCon')
      LIMIT 1
    SQL

    precon_id = precon_result.count.positive? ? precon_result.first['id'] : nil
    puts "[CreateQuoteTrackers] PreCon tab id: #{precon_id || 'NOT FOUND'}"

    # Check if Quote Tracker tab already exists
    existing_tab = execute(<<-SQL.squish)
      SELECT id FROM warehouse_folders
      WHERE warehouse_type = 'job' AND tab_key = 'quote-tracker'
      LIMIT 1
    SQL

    if existing_tab.count.zero?
      # Get tenant_id from PreCon parent (or use first tenant if no parent)
      precon_tenant_id = precon_id ? execute("SELECT tenant_id FROM warehouse_folders WHERE id = #{precon_id}").first&.dig('tenant_id') : nil
      tenant_id_val = precon_tenant_id || execute("SELECT id FROM tenants ORDER BY id LIMIT 1").first&.dig('id')

      # FRC Note (Feb 2026): MUST set warehouse_enabled=false for Foundation-backed tabs
      # Otherwise inherit_warehouse_from_parent callback auto-sets warehouse_enabled=true
      # from parent (PreCon), then warehouse:fix_folder_paths auto-populates folder_path,
      # which makes frontend try to load SharePoint documents instead of the component.
      execute(<<-SQL.squish)
        INSERT INTO warehouse_folders (
          tenant_id, warehouse_type, tab_key, display_name, parent_id, tab_group,
          order_position, enabled, is_system_tab, icon_name, component_name,
          warehouse_enabled,
          created_at, updated_at
        )
        VALUES (
          #{tenant_id_val || 'NULL'},
          'job',
          'quote-tracker',
          'Quote Tracker',
          #{precon_id || 'NULL'},
          'documents',
          -1,
          true,
          true,
          'clipboard-list',
          'JobQuoteTrackerTab',
          false,
          NOW(), NOW()
        )
      SQL
      puts "[CreateQuoteTrackers] Created Quote Tracker tab under PreCon"
    else
      puts "[CreateQuoteTrackers] Quote Tracker tab already exists"
    end
  end

  def down
    # Remove the Quote Tracker tab
    execute("DELETE FROM warehouse_folders WHERE tab_key = 'quote-tracker' AND warehouse_type = 'job'")

    # Remove columns
    execute("DELETE FROM columns WHERE foundation_id = (SELECT id FROM foundations WHERE slug = 'quote-tracker')")

    # Remove Foundation
    execute("DELETE FROM foundations WHERE slug = 'quote-tracker'")

    # Drop the table
    drop_table :quote_trackers
  end
end
